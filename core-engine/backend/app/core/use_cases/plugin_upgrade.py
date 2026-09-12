# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Plugin Upgrade Use Case
# Pipeline nâng cấp plugin lên version mới theo mô hình async job + Saga bù trừ:
#   validate (sync) → snapshot → migrate DB (atomic + tracking) →
#   n8n update-in-place → metabase/appsmith blue-green → keycloak roles →
#   bump version → ACTIVE.
# Thất bại ở bước nào cũng rollback phần đã làm + FAILED_DIRTY + cho retry.

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from packaging.version import InvalidVersion, parse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.local_manifest_parser import LocalManifestParser
from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginStatus, TenantContext
from app.core.domain.plugin_manifest import PluginManifest
from app.core.domain.ports import (
    AbstractAnalyticsPort,
    AbstractChatOpsPort,
    AbstractEventBusPort,
    AbstractIdentityProviderPort,
    AbstractManifestParserPort,
    AbstractUIBuilderPort,
    AbstractWorkflowEnginePort,
)
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class PluginUpgradeError(Exception):
    pass


# SQL nguy hiểm (check sau khi strip comment). Chặt hơn bản cũ (chỉ `in` thô):
# TRUNCATE, DROP COLUMN/SCHEMA/DATABASE, ALTER...DROP.
_DANGEROUS_SQL = re.compile(
    r"\bDROP\s+(TABLE|COLUMN|SCHEMA|DATABASE)\b"
    r"|\bTRUNCATE\b"
    r"|\bALTER\s+TABLE\b.{0,200}?\bDROP\b",
    re.IGNORECASE | re.DOTALL,
)

_MIGRATION_FILE_RE = re.compile(r"^V(\d+\.\d+\.\d+)__.+\.sql$")


def _strip_sql_comments(sql: str) -> str:
    """Bỏ comment -- và /* */ để check safety không báo nhầm."""
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql


def _split_sql_statements(sql: str) -> list[str]:
    """Split file SQL thành từng statement, tôn trọng $$ dollar-quoting,
    string literal '...' và comment (asyncpg không chạy multi-statement)."""
    statements: list[str] = []
    buf: list[str] = []
    i, n = 0, len(sql)
    in_single = False
    in_line_comment = False
    in_block_comment = False
    dollar_tag: str | None = None
    while i < n:
        if dollar_tag is not None:
            if sql.startswith(dollar_tag, i):
                buf.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
            else:
                buf.append(sql[i])
                i += 1
            continue
        if in_line_comment:
            if sql[i] == "\n":
                in_line_comment = False
                buf.append(sql[i])
            i += 1
            continue
        if in_block_comment:
            if sql.startswith("*/", i):
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue
        if in_single:
            buf.append(sql[i])
            if sql[i] == "'":
                if sql.startswith("''", i):
                    buf.append("'")
                    i += 2
                    continue
                in_single = False
            i += 1
            continue
        if sql.startswith("--", i):
            in_line_comment = True
            i += 2
            continue
        if sql.startswith("/*", i):
            in_block_comment = True
            i += 2
            continue
        if sql[i] == "'":
            in_single = True
            buf.append(sql[i])
            i += 1
            continue
        m = re.match(r"\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$", sql[i:])
        if m:
            dollar_tag = m.group(0)
            buf.append(dollar_tag)
            i += len(dollar_tag)
            continue
        if sql[i] == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(sql[i])
        i += 1
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


class PluginUpgradeUseCase:
    """
    Quản lý pipeline nâng cấp Plugin (async, chạy background).

    Quy ước version: manifest.version (packaging.version) so với
    tenant_plugins.installed_version.
    """

    def __init__(
        self,
        plugin_repo: AbstractPluginRepository,
        manifest_parser: AbstractManifestParserPort | LocalManifestParser,
        n8n_adapter: AbstractWorkflowEnginePort,
        metabase_adapter: AbstractAnalyticsPort,
        appsmith_adapter: AbstractUIBuilderPort,
        keycloak_adapter: AbstractIdentityProviderPort,
        mattermost_adapter: AbstractChatOpsPort,
        session: AsyncSession,
        event_bus: AbstractEventBusPort | None = None,
        tenant_repo=None,
    ) -> None:
        self.plugin_repo = plugin_repo
        self.manifest_parser = manifest_parser
        self.n8n_adapter = n8n_adapter
        self.metabase_adapter = metabase_adapter
        self.appsmith_adapter = appsmith_adapter
        self.keycloak_adapter = keycloak_adapter
        self.mattermost_adapter = mattermost_adapter
        self.session = session
        self.event_bus = event_bus
        self.tenant_repo = tenant_repo
        self._steps_log: list[dict[str, Any]] = []

    # ─── Phase 1: validate (chạy sync trong request) ──────────────────────

    async def prepare_upgrade(
        self, context: TenantContext, plugin_id: uuid.UUID
    ) -> tuple[Any, str, str]:
        """Validate điều kiện upgrade. Trả về (plugin, from_version, to_version)."""
        plugin = await self.plugin_repo.get_by_id(plugin_id)
        if not plugin:
            raise PluginUpgradeError("Plugin không tồn tại.")

        status = await self.plugin_repo.get_installation_status(
            context.tenant_id, plugin_id
        )
        if status not in (PluginStatus.ACTIVE, PluginStatus.DISABLED):
            raise PluginUpgradeError(
                f"Chỉ nâng cấp được plugin ACTIVE/DISABLED (hiện tại: {status})."
            )

        installed_version = await self.plugin_repo.get_installed_version(
            context.tenant_id, plugin_id
        )
        if not installed_version:
            raise PluginUpgradeError(
                "Không xác định được phiên bản đang cài đặt để nâng cấp."
            )

        manifest = self.manifest_parser.parse(plugin.code_name)
        new_version = manifest.version

        try:
            parsed_installed = parse(installed_version)
            parsed_new = parse(new_version)
        except InvalidVersion as e:
            raise PluginUpgradeError(
                f"Định dạng phiên bản không hợp lệ: installed={installed_version}, "
                f"new={new_version}"
            ) from e

        if parsed_new <= parsed_installed:
            raise PluginUpgradeError(
                f"Phiên bản mới ({new_version}) phải lớn hơn phiên bản hiện tại "
                f"({installed_version})."
            )

        return plugin, installed_version, new_version

    # ─── Phase 2: pipeline (chạy background) ──────────────────────────────

    async def run_upgrade(
        self,
        context: TenantContext,
        plugin_code_name: str,
        task_id: uuid.UUID,
    ) -> None:
        """Chạy toàn bộ pipeline upgrade. Fail ở đâu rollback tới đó."""
        self._steps_log = []
        plugin = await self.plugin_repo.get_by_code_name(plugin_code_name)
        if not plugin:
            raise PluginUpgradeError(f"Plugin '{plugin_code_name}' không tồn tại.")
        manifest = self.manifest_parser.parse(plugin_code_name)

        from_version = (
            await self.plugin_repo.get_installed_version(
                context.tenant_id, plugin.id
            )
            or "unknown"
        )
        to_version = manifest.version
        was_disabled = (
            await self.plugin_repo.get_installation_status(
                context.tenant_id, plugin.id
            )
        ) == PluginStatus.DISABLED

        # 0. Snapshot trạng thái cũ để rollback (n8n exports + config + version)
        self._log_step("snapshot", "RUNNING")
        snapshot = await self._snapshot(context, plugin.id)
        self._log_step("snapshot", "DONE")
        await self._persist_steps(context, plugin.id)

        created_assets: dict[str, list[str]] = {
            "n8n": [],
            "metabase": [],
            "appsmith": [],
        }
        try:
            # 1. DB migrations (atomic — fail là rollback toàn bộ, chưa đụng n8n)
            self._log_step("database", "RUNNING")
            applied = await self._step_db_migrations(
                context, plugin.id, plugin_code_name, manifest, from_version
            )
            self._log_step(
                "database", "DONE", f"{applied} migration(s) đã chạy"
            )
            await self._persist_steps(context, plugin.id)

            # 2. n8n update-in-place
            self._log_step("n8n", "RUNNING")
            new_n8n_ids = await self._step_n8n_update(
                context, plugin_code_name, manifest, snapshot
            )
            created_assets["n8n"] = new_n8n_ids
            self._log_step("n8n", "DONE")
            await self._persist_steps(context, plugin.id)

            # 3. Metabase blue-green (import mới → xóa cũ)
            self._log_step("metabase", "RUNNING")
            new_mb_ids = await self._step_metabase_replace(
                context, plugin_code_name, manifest, snapshot
            )
            created_assets["metabase"] = new_mb_ids
            self._log_step("metabase", "DONE")
            await self._persist_steps(context, plugin.id)

            # 4. Appsmith blue-green
            self._log_step("appsmith", "RUNNING")
            new_app_ids = await self._step_appsmith_replace(
                context, plugin_code_name, manifest, snapshot
            )
            created_assets["appsmith"] = new_app_ids
            self._log_step("appsmith", "DONE")
            await self._persist_steps(context, plugin.id)

            # 5. Keycloak roles (additive, 409-tolerant)
            self._log_step("keycloak", "RUNNING")
            await self._step_keycloak_roles(context, plugin_code_name, manifest)
            self._log_step("keycloak", "DONE")
            await self._persist_steps(context, plugin.id)

            # 6. Bump version + trạng thái (giữ DISABLED nếu trước đó disabled)
            final_status = (
                PluginStatus.DISABLED if was_disabled else PluginStatus.ACTIVE
            )
            await self.plugin_repo.upsert_installation(
                tenant_id=context.tenant_id,
                plugin_id=plugin.id,
                status=final_status,
                installed_version=to_version,
            )
            # Cập nhật config_override với asset ids mới
            prev_config = await self.plugin_repo.get_config(
                context.tenant_id, plugin.id
            )
            merged_config = dict(prev_config or {})
            merged_config.update(
                {
                    k: v
                    for k, v in created_assets.items()
                    if v is not None
                }
            )
            await self.plugin_repo.update_config(
                tenant_id=context.tenant_id,
                plugin_id=plugin.id,
                config_override=merged_config,
            )
            await self.plugin_repo.set_upgrade_task_id(
                context.tenant_id, plugin.id, None
            )
            self._log_step(
                "complete", "DONE", f"{from_version} → {to_version}"
            )
            await self._persist_steps(context, plugin.id)
            await self.session.commit()

            try:
                await self.mattermost_adapter.send_message(
                    settings.MATTERMOST_SYSTEM_CHANNEL_ID,
                    f"✅ Đã nâng cấp Plugin **{manifest.display_name}** "
                    f"({from_version} → {to_version}).",
                )
            except Exception as e:
                logger.warning("Bỏ qua thông báo Mattermost: %s", e)
            if self.event_bus:
                try:
                    await self.event_bus.publish_plugin_lifecycle(
                        action="upgraded",
                        tenant_id=str(context.tenant_id),
                        plugin_name=plugin_code_name,
                        plugin_version=to_version,
                    )
                except Exception as e:
                    logger.warning("Không publish event plugin.upgraded: %s", e)
            logger.info(
                "Nâng cấp plugin thành công",
                extra={
                    "plugin": plugin_code_name,
                    "from": from_version,
                    "to": to_version,
                },
            )
        except Exception as e:
            logger.error(
                "Nâng cấp plugin thất bại",
                extra={"plugin": plugin_code_name, "error": str(e)},
                exc_info=True,
            )
            if self._steps_log and self._steps_log[-1].get("status") == "RUNNING":
                self._log_step(self._steps_log[-1]["step"], "FAILED", str(e))
            await self._compensate(
                context, plugin.id, plugin_code_name, snapshot, created_assets
            )
            try:
                await self.session.rollback()
                await self.session.execute(text("SET search_path TO public"))
            except Exception as reset_err:
                logger.warning("Không reset được session: %s", reset_err)
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin.id,
                status=PluginStatus.FAILED_DIRTY,
                error_log=f"Upgrade {from_version} → {to_version} thất bại: {e}",
            )
            try:
                await self.plugin_repo.update_install_steps_log(
                    context.tenant_id, plugin.id, self._steps_log
                )
            except Exception as log_err:
                logger.warning("Không lưu được steps_log: %s", log_err)
            await self.session.commit()
            try:
                await self.mattermost_adapter.send_message(
                    settings.MATTERMOST_SYSTEM_CHANNEL_ID,
                    f"❌ Nâng cấp Plugin **{plugin_code_name}** thất bại: {e}",
                )
            except Exception:
                pass
            if self.event_bus:
                try:
                    await self.event_bus.publish_plugin_lifecycle(
                        action="failed",
                        tenant_id=str(context.tenant_id),
                        plugin_name=plugin_code_name,
                        plugin_version=to_version,
                        extra_data={"error": str(e), "phase": "upgrade"},
                    )
                except Exception:
                    pass
            raise PluginUpgradeError(f"Nâng cấp plugin thất bại: {e}") from e

    # ─── Steps ────────────────────────────────────────────────────────────

    async def _snapshot(
        self, context: TenantContext, plugin_id: uuid.UUID
    ) -> dict[str, Any]:
        """Chụp trạng thái hiện tại: config assets + export workflow n8n."""
        config = await self.plugin_repo.get_config(context.tenant_id, plugin_id)
        snap: dict[str, Any] = {
            "config_override": dict(config or {}),
            "n8n_exports": {},
        }
        for wid in (config or {}).get("n8n", []) or []:
            try:
                exported = await self.n8n_adapter.get_workflow(str(wid))
                if exported:
                    snap["n8n_exports"][str(wid)] = exported
            except Exception as e:
                logger.warning("Không snapshot được workflow %s: %s", wid, e)
        return snap

    def _discover_migrations(
        self,
        plugin_code_name: str,
        from_version: str,
        applied: dict[str, dict[str, str]],
    ) -> list[tuple[Any, str, str, str]]:
        """Tìm file migration cần chạy: version trong (installed, manifest],
        chưa applied; applied rồi mà checksum đổi → lỗi cứng."""
        try:
            parsed_installed = parse(from_version)
        except InvalidVersion as e:
            raise PluginUpgradeError(
                f"installed_version không hợp lệ: {from_version}"
            ) from e

        parser = self.manifest_parser
        plugins_dir = getattr(parser, "plugins_dir", None)
        if plugins_dir is None:
            # LocalManifestParser mặc định
            from app.adapters.external.local_manifest_parser import (
                LocalManifestParser,
            )

            plugins_dir = LocalManifestParser().plugins_dir
        migrations_dir = os.path.join(
            str(plugins_dir), plugin_code_name, "migrations"
        )
        if not os.path.exists(migrations_dir):
            return []

        manifest = parser.parse(plugin_code_name)
        try:
            parsed_new = parse(manifest.version)
        except InvalidVersion as e:
            raise PluginUpgradeError(
                f"manifest version không hợp lệ: {manifest.version}"
            ) from e

        pending: list[tuple[Any, str, str, str]] = []
        for fname in os.listdir(migrations_dir):
            match = _MIGRATION_FILE_RE.match(fname)
            if not match:
                continue
            v_str = match.group(1)
            try:
                v_parsed = parse(v_str)
            except InvalidVersion:
                continue
            if not (parsed_installed < v_parsed <= parsed_new):
                continue
            fpath = os.path.join(migrations_dir, fname)
            with open(fpath, "rb") as f:
                checksum = hashlib.sha256(f.read()).hexdigest()
            if v_str in applied:
                if applied[v_str].get("checksum") != checksum:
                    raise PluginUpgradeError(
                        f"Migration {fname} đã chạy với nội dung khác "
                        f"(checksum đổi) — từ chối upgrade để tránh lệch schema. "
                        f"Hãy tạo migration version mới thay vì sửa file cũ."
                    )
                continue  # đã chạy rồi → bỏ qua (retry an toàn)
            pending.append((v_parsed, fpath, fname, checksum))
        pending.sort(key=lambda x: x[0])
        return pending

    async def _step_db_migrations(
        self,
        context: TenantContext,
        plugin_id: uuid.UUID,
        plugin_code_name: str,
        manifest: PluginManifest,
        from_version: str,
    ) -> int:
        """Chạy migration DB trong 1 transaction (atomic)."""
        applied = await self.plugin_repo.list_applied_migrations(
            context.tenant_id, plugin_id
        )
        pending = self._discover_migrations(
            plugin_code_name, from_version, applied
        )
        if not pending:
            logger.info("Không có migration DB nào cần chạy.")
            return 0

        schema_name = f"tenant_{context.tenant_id}".replace("-", "_")
        if not re.match(r"^[a-zA-Z0-9_]+$", schema_name):
            raise PluginUpgradeError("Invalid schema name.")
        # Sandbox search_path giống luồng install (KHÔNG set role).
        await self.session.execute(
            text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
        )
        await self.session.execute(
            text(f'SET search_path TO "{schema_name}", public')
        )
        try:
            for _, fpath, fname, checksum in pending:
                with open(fpath, encoding="utf-8-sig") as f:
                    sql_content = f.read()
                safe_sql = _strip_sql_comments(sql_content)
                if _DANGEROUS_SQL.search(safe_sql):
                    raise PluginUpgradeError(
                        f"Migration {fname} chứa lệnh nguy hiểm "
                        f"(DROP/TRUNCATE/ALTER..DROP) — bị từ chối."
                    )
                for stmt in _split_sql_statements(sql_content):
                    await self.session.execute(text(stmt))
                version = _MIGRATION_FILE_RE.match(fname).group(1)  # type: ignore[union-attr]
                await self.plugin_repo.record_applied_migration(
                    context.tenant_id, plugin_id, version, fname, checksum
                )
        finally:
            await self.session.execute(text("SET search_path TO public"))
        return len(pending)

    async def _step_n8n_update(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        snapshot: dict[str, Any],
    ) -> list[str]:
        """Update workflow tại chỗ theo tên; file mới thì import thêm.

        Trả về danh sách id mới đầy đủ (để lưu config_override)."""
        # Index workflow hiện có theo tên để match.
        existing_by_name: dict[str, str] = {}
        try:
            listing = await self.n8n_adapter.list_workflows(limit=200)
            for wf in listing or []:
                if wf.get("name"):
                    existing_by_name[wf["name"]] = str(wf.get("id"))
        except Exception as e:
            logger.warning("Không list được workflows n8n: %s", e)

        # Attach credentials dùng chung (giống luồng install).
        tenant_schema = f"tenant_{str(context.tenant_id).replace('-', '_')}"
        proteus_db_cred_id = await self._find_n8n_credential("ProteusDB_Real")
        proteus_mm_cred_id, proteus_mm_cred_name = await self._ensure_mm_credential()
        proteus_ollama_cred_id, proteus_ollama_cred_name = (
            await self._ensure_ollama_credential()
        )
        alerts_channel_id = None
        if self.tenant_repo is not None:
            try:
                from app.core.use_cases.tenant_onboarding import (
                    get_tenant_alerts_channel_id,
                )

                alerts_channel_id = await get_tenant_alerts_channel_id(
                    self.tenant_repo, self.mattermost_adapter, context.tenant_id
                )
            except Exception as e:
                logger.warning("Không resolve được alerts channel: %s", e)

        new_ids: list[str] = []
        parser = self.manifest_parser
        plugins_dir = getattr(parser, "plugins_dir", None)
        if plugins_dir is None:
            from app.adapters.external.local_manifest_parser import (
                LocalManifestParser,
            )

            plugins_dir = LocalManifestParser().plugins_dir

        import json as _json

        for wf in manifest.workflows:
            wf_path = plugins_dir / plugin_code_name / wf.file
            if not wf_path.exists():
                logger.warning("Thiếu file workflow %s — bỏ qua", wf.file)
                continue
            with open(wf_path, encoding="utf-8-sig") as f:
                wf_json = _json.load(f)
            self._bind_workflow_credentials(
                wf_json,
                tenant_schema,
                proteus_db_cred_id,
                proteus_mm_cred_id,
                proteus_mm_cred_name,
                proteus_ollama_cred_id,
                proteus_ollama_cred_name,
                alerts_channel_id,
            )
            wf_name = wf_json.get("name") or wf.file
            old_id = existing_by_name.get(wf_name)
            if old_id and old_id in snapshot.get("n8n_exports", {}):
                await self.n8n_adapter.update_workflow(old_id, wf_json)
                new_ids.append(old_id)
                logger.info("Đã update workflow n8n tại chỗ", extra={"id": old_id})
            elif old_id:
                # Tồn tại trên n8n nhưng ngoài snapshot (tạo tay?) → update luôn.
                await self.n8n_adapter.update_workflow(old_id, wf_json)
                new_ids.append(old_id)
            else:
                wid = await self.n8n_adapter.import_workflow(wf_json)
                new_ids.append(wid)
            try:
                await self.n8n_adapter.activate_workflow(new_ids[-1])
            except Exception as act_err:
                logger.warning(
                    "Không activate được workflow %s: %s", new_ids[-1], act_err
                )
        return new_ids

    async def _step_metabase_replace(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        snapshot: dict[str, Any],
    ) -> list[str]:
        """Blue-green dashboards: import mới trước, xóa cũ sau."""
        parser = self.manifest_parser
        plugins_dir = getattr(parser, "plugins_dir", None)
        if plugins_dir is None:
            from app.adapters.external.local_manifest_parser import (
                LocalManifestParser,
            )

            plugins_dir = LocalManifestParser().plugins_dir

        import json as _json

        new_ids: list[str] = []
        for db in manifest.dashboards:
            db_path = plugins_dir / plugin_code_name / db.file
            if not db_path.exists():
                continue
            with open(db_path, encoding="utf-8-sig") as f:
                db_json = _json.load(f)
            did = await self.metabase_adapter.import_dashboard(db_json)
            new_ids.append(str(did))
        # Xóa bản cũ sau khi bản mới đã lên (an toàn hơn xóa trước).
        for old_id in (snapshot.get("config_override", {}) or {}).get("metabase", []) or []:
            try:
                await self.metabase_adapter.delete_dashboard(str(old_id))
            except Exception as e:
                logger.warning("Không xóa được dashboard cũ %s: %s", old_id, e)
        return new_ids

    async def _step_appsmith_replace(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        snapshot: dict[str, Any],
    ) -> list[str]:
        """Blue-green apps: import mới trước, xóa cũ sau."""
        integration_config = None
        if self.tenant_repo and hasattr(
            self.tenant_repo, "get_integration_by_provider"
        ):
            integration = await self.tenant_repo.get_integration_by_provider(
                context.tenant_id, "appsmith"
            )
            if integration:
                integration_config = (
                    integration.config
                    if hasattr(integration, "config")
                    else integration.get("config")
                )

        parser = self.manifest_parser
        plugins_dir = getattr(parser, "plugins_dir", None)
        if plugins_dir is None:
            from app.adapters.external.local_manifest_parser import (
                LocalManifestParser,
            )

            plugins_dir = LocalManifestParser().plugins_dir

        import json as _json

        # Manifest chỉ có 1 appsmith_app duy nhất (giống luồng install).
        new_ids: list[str] = []
        app_file = manifest.ui.appsmith_app if manifest.ui else None
        if app_file:
            app_path = plugins_dir / plugin_code_name / app_file
            if app_path.exists():
                with open(app_path, encoding="utf-8-sig") as f:
                    app_json = _json.load(f)
                aid = await self.appsmith_adapter.import_application(
                    app_json, integration_config
                )
                new_ids.append(str(aid))
        for old_id in (snapshot.get("config_override", {}) or {}).get("appsmith", []) or []:
            try:
                await self.appsmith_adapter.delete_application(
                    str(old_id), integration_config
                )
            except Exception as e:
                logger.warning("Không xóa được app cũ %s: %s", old_id, e)
        return new_ids

    async def _step_keycloak_roles(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
    ) -> list[str]:
        """Đảm bảo roles mới (additive, create_role 409-tolerant)."""
        keycloak_realm = "proteus"
        if self.tenant_repo:
            tenant = await self.tenant_repo.get_by_id(context.tenant_id)
            if tenant:
                keycloak_realm = tenant.keycloak_realm
        created_roles = []
        for role in manifest.roles:
            if hasattr(self.keycloak_adapter, "create_role"):
                await self.keycloak_adapter.create_role(
                    realm=keycloak_realm,
                    role_name=f"{plugin_code_name}_{role.name}",
                )
                created_roles.append(role.name)
        return created_roles

    # ─── Helpers ──────────────────────────────────────────────────────

    async def _find_n8n_credential(self, name: str) -> str | None:
        if not self.session:
            return None
        try:
            res = await self.session.execute(
                text(
                    "SELECT id FROM n8n.credentials_entity WHERE name = :n LIMIT 1"
                ),
                {"n": name},
            )
            row = res.fetchone()
            return str(row[0]) if row else None
        except Exception:
            return None

    async def _ensure_mm_credential(self) -> tuple[str | None, str | None]:
        cred_id = await self._find_n8n_credential("ProteusMM")
        if cred_id:
            return cred_id, "ProteusMM"
        if not settings.MATTERMOST_BOT_TOKEN:
            return None, None
        try:
            created = await self.n8n_adapter.create_credential(
                credential_type="mattermostApi",
                credential_name="ProteusMM",
                data={
                    "baseUrl": settings.MATTERMOST_URL,
                    "accessToken": settings.MATTERMOST_BOT_TOKEN,
                },
            )
            return str(created.get("id")), "ProteusMM"
        except Exception as e:
            logger.warning("Không tạo được credential ProteusMM: %s", e)
            return None, None

    async def _ensure_ollama_credential(self) -> tuple[str | None, str | None]:
        cred_id = await self._find_n8n_credential("ProteusOllama")
        if cred_id:
            return cred_id, "ProteusOllama"
        try:
            ollama_base = (settings.LLM_BASE_URL or "").rstrip("/")
            if ollama_base.endswith("/v1"):
                ollama_base = ollama_base[: -len("/v1")]
            if not ollama_base:
                return None, None
            created = await self.n8n_adapter.create_credential(
                credential_type="ollamaApi",
                credential_name="ProteusOllama",
                data={"baseUrl": ollama_base},
            )
            return str(created.get("id")), "ProteusOllama"
        except Exception as e:
            logger.warning("Không tạo được credential ProteusOllama: %s", e)
            return None, None

    def _bind_workflow_credentials(
        self,
        wf_json: dict[str, Any],
        tenant_schema: str,
        proteus_db_cred_id: str | None,
        proteus_mm_cred_id: str | None,
        proteus_mm_cred_name: str | None,
        proteus_ollama_cred_id: str | None,
        proteus_ollama_cred_name: str | None,
        alerts_channel_id: str | None = None,
    ) -> None:
        """Gắn credentials dùng chung vào nodes (giống luồng install)."""
        for node in wf_json.get("nodes", []):
            if (node.get("type") or "") == "n8n-nodes-base.webhook":
                params = node.setdefault("parameters", {})
                if isinstance(params, dict) and not params.get("httpMethod"):
                    params["httpMethod"] = "POST"
            if "parameters" in node and "query" in node["parameters"]:
                query = node["parameters"]["query"]
                if "{{TENANT_SCHEMA}}" in query:
                    node["parameters"]["query"] = query.replace(
                        "{{TENANT_SCHEMA}}", tenant_schema
                    )
            ntype = (node.get("type") or "").lower()
            needs_creds = (
                node.get("type") == "n8n-nodes-base.postgres"
                or "mattermost" in ntype
                or "ollama" in ntype
            )
            if needs_creds and not isinstance(node.get("credentials"), dict):
                node["credentials"] = {}
            if node.get("type") == "n8n-nodes-base.postgres":
                node["credentials"].setdefault("postgres", {})
            if "mattermost" in ntype:
                node["credentials"].setdefault("mattermostApi", {})
                if proteus_mm_cred_id:
                    node["credentials"]["mattermostApi"]["id"] = proteus_mm_cred_id
                    node["credentials"]["mattermostApi"]["name"] = proteus_mm_cred_name
                params = node.get("parameters")
                if (
                    isinstance(params, dict)
                    and not params.get("channelId")
                    and alerts_channel_id
                ):
                    params["channelId"] = alerts_channel_id
            if "ollama" in ntype:
                node["credentials"].setdefault("ollamaApi", {})
                if proteus_ollama_cred_id:
                    node["credentials"]["ollamaApi"]["id"] = proteus_ollama_cred_id
                    node["credentials"]["ollamaApi"]["name"] = proteus_ollama_cred_name
            if "credentials" in node:
                for cred_key, cred_val in node["credentials"].items():
                    if (
                        node.get("type") == "n8n-nodes-base.postgres"
                        and cred_key == "postgres"
                        and proteus_db_cred_id
                    ):
                        node["credentials"][cred_key]["id"] = proteus_db_cred_id
                        node["credentials"][cred_key]["name"] = "ProteusDB_Real"

    async def _compensate(
        self,
        context: TenantContext,
        plugin_id: uuid.UUID,
        plugin_code_name: str,
        snapshot: dict[str, Any],
        created_assets: dict[str, list[str]],
    ) -> None:
        """Bù trừ khi upgrade fail: DB rollback bởi transaction; ở đây khôi phục
        n8n từ snapshot, xóa asset mới tạo, giữ nguyên version cũ."""
        # n8n: restore JSON cũ cho workflow đã update.
        for wid, old_json in (snapshot.get("n8n_exports") or {}).items():
            try:
                await self.n8n_adapter.update_workflow(str(wid), old_json)
                logger.info("Đã restore workflow n8n %s về bản cũ", wid)
            except Exception as e:
                logger.warning("Không restore được workflow %s: %s", wid, e)
        # Xóa dashboards/apps MỚI đã import (bản cũ chưa hề bị xóa).
        for did in created_assets.get("metabase", []) or []:
            try:
                await self.metabase_adapter.delete_dashboard(str(did))
            except Exception as e:
                logger.warning("Không dọn được dashboard mới %s: %s", did, e)
        for aid in created_assets.get("appsmith", []) or []:
            try:
                await self.appsmith_adapter.delete_application(str(aid))
            except Exception as e:
                logger.warning("Không dọn được app mới %s: %s", aid, e)
        # n8n workflows MỚI import thêm (không update) → xóa.
        prev_ids = {
            str(wid) for wid in (snapshot.get("config_override", {}) or {}).get("n8n", []) or []
        }
        for wid in created_assets.get("n8n", []) or []:
            if str(wid) not in prev_ids and str(wid) not in (
                snapshot.get("n8n_exports") or {}
            ):
                try:
                    await self.n8n_adapter.delete_workflow(str(wid))
                except Exception as e:
                    logger.warning("Không dọn được workflow mới %s: %s", wid, e)

    def _log_step(
        self, step: str, status: str, message: str | None = None
    ) -> None:
        existing = next((s for s in self._steps_log if s["step"] == step), None)
        entry = {
            "step": step,
            "status": status,
            "at": datetime.now(UTC).isoformat(),
            "message": message,
        }
        if existing:
            existing.update(entry)
        else:
            self._steps_log.append(entry)

    async def _persist_steps(
        self, context: TenantContext, plugin_id: uuid.UUID
    ) -> None:
        try:
            await self.plugin_repo.update_install_steps_log(
                context.tenant_id, plugin_id, self._steps_log
            )
            await self.session.commit()
        except Exception as e:
            logger.warning("Không lưu được steps_log: %s", e)
            try:
                await self.session.rollback()
            except Exception:
                pass

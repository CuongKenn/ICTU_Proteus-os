# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Plugin Install Use Case
# Xử lý 6 bước cài đặt Plugin theo mô hình Saga (Compensating Transaction).

import json
import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.local_manifest_parser import LocalManifestParser
from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import CredentialInput, PluginStatus, TenantContext
from app.core.domain.plugin_manifest import PluginManifest
from app.core.domain.ports import (
    AbstractAnalyticsPort,
    AbstractChatOpsPort,
    AbstractEventBusPort,
    AbstractIdentityProviderPort,
    AbstractUIBuilderPort,
    AbstractWorkflowEnginePort,
)
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class PluginInstallError(Exception):
    """Lỗi khi cài đặt Plugin."""


class PluginInstallUseCase:
    """
    Quản lý luồng cài đặt Plugin cho một Tenant.
    Thực hiện tuần tự 6 bước, rollback nếu có lỗi.
    """

    def __init__(
        self,
        plugin_repo: AbstractPluginRepository,
        manifest_parser: LocalManifestParser,
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
        # ─ Install steps log (mược lướu theo từng execute() call)
        self._steps_log: list[dict[str, Any]] = []
        self._credential_ids: list[dict[str, str]] = []

    async def execute(
        self,
        context: TenantContext,
        plugin_code_name: str,
        credentials: list[CredentialInput] | None = None,
    ) -> None:
        logger.info(
            "Bắt đầu cài đặt plugin %s cho tenant %s",
            plugin_code_name,
            context.tenant_id,
        )

        # Reset state
        self._steps_log = []
        self._credential_ids = []

        # 1. Fetch plugin metadata and tenant
        plugin = await self.plugin_repo.get_by_code_name(plugin_code_name)
        tenant = None
        if getattr(self, "tenant_repo", None):
            tenant = await self.tenant_repo.get_by_id(context.tenant_id)

        if not plugin:
            raise PluginInstallError(
                f"Plugin '{plugin_code_name}' không tồn tại trên Marketplace."
            )

        # 2. Check if already installed
        status = await self.plugin_repo.get_installation_status(
            context.tenant_id, plugin.id
        )
        if status in (
            PluginStatus.ACTIVE,
            PluginStatus.INSTALLING,
            PluginStatus.UNINSTALLING,
        ):
            raise PluginInstallError(
                f"Plugin '{plugin_code_name}' đang ở trạng thái {status}."
            )

        # 3. Load manifest
        manifest = self.manifest_parser.parse(plugin_code_name)

        # 4. Compatibility check: proteus_os_min_version
        self._check_version_compatibility(manifest)

        # 5. Mark as INSTALLING
        await self.plugin_repo.upsert_installation(
            tenant_id=context.tenant_id,
            plugin_id=plugin.id,
            status=PluginStatus.INSTALLING,
            installed_version=manifest.version,
        )
        await self.session.commit()

        completed_steps: list[str] = []
        created_assets: dict[str, list[str]] = {}
        try:
            # BƯỚC 1: Database Setup
            self._log_step("database", "RUNNING")
            await self._step_1_database(context, plugin_code_name, manifest)
            self._log_step("database", "DONE")
            completed_steps.append("database")
            await self._persist_steps(context, plugin.id)

            # BƯỚC 2: n8n Import
            self._log_step("n8n", "RUNNING")
            n8n_ids = await self._step_2_n8n(context, plugin_code_name, manifest)
            created_assets["n8n"] = n8n_ids
            self._log_step("n8n", "DONE")
            completed_steps.append("n8n")
            await self._persist_steps(context, plugin.id)

            # BƯỚC 3: Metabase Import
            self._log_step("metabase", "RUNNING")
            mb_ids = await self._step_3_metabase(context, plugin_code_name, manifest)
            created_assets["metabase"] = mb_ids
            self._log_step("metabase", "DONE")
            completed_steps.append("metabase")
            await self._persist_steps(context, plugin.id)

            # BƯỚC 4: Appsmith Import
            self._log_step("appsmith", "RUNNING")
            app_ids = await self._step_4_appsmith(context, plugin_code_name, manifest)
            created_assets["appsmith"] = app_ids
            self._log_step("appsmith", "DONE")
            completed_steps.append("appsmith")
            await self._persist_steps(context, plugin.id)

            # BƯỚC 5: Keycloak Roles
            self._log_step("keycloak", "RUNNING")
            roles = await self._step_5_keycloak(context, plugin_code_name, manifest)
            created_assets["keycloak"] = roles
            self._log_step("keycloak", "DONE")
            completed_steps.append("keycloak")
            await self._persist_steps(context, plugin.id)

            # BƯỚC 6: Event Subscriptions
            self._log_step("events", "RUNNING")
            events = await self._step_6_events(context, plugin_code_name, manifest)
            created_assets["events"] = events
            self._log_step("events", "DONE")
            completed_steps.append("events")
            await self._persist_steps(context, plugin.id)

            # BƯỚC 7: Credentials (n8n) — sau cùng trước SUCCESS
            if credentials:
                self._log_step("credentials", "RUNNING")
                cred_ids = await self._step_7_credentials(
                    context, plugin_code_name, manifest, credentials
                )
                created_assets["credentials"] = [c["id"] for c in cred_ids]
                self._log_step("credentials", "DONE")
                completed_steps.append("credentials")
                # Lưu credential IDs để rollback khi uninstall
                await self.plugin_repo.update_credential_ids(
                    tenant_id=context.tenant_id,
                    plugin_id=plugin.id,
                    credential_ids=cred_ids,
                )
                await self._persist_steps(context, plugin.id)

            # SUCCESS
            await self.plugin_repo.update_config(
                tenant_id=context.tenant_id,
                plugin_id=plugin.id,
                config_override=created_assets,
            )
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin.id,
                status=PluginStatus.ACTIVE,
            )
            self._log_step("complete", "DONE")
            await self._persist_steps(context, plugin.id)
            await self.session.commit()

            # Notify Mattermost (Best effort)
            try:
                msg = (
                    f"✅ Đã cài đặt thành công Plugin "
                    f"**{manifest.display_name}** ({manifest.version})."
                )
                channel_id = (
                    tenant.notify_channel_id or settings.MATTERMOST_SYSTEM_CHANNEL_ID
                    if tenant
                    else settings.MATTERMOST_SYSTEM_CHANNEL_ID
                )
                await self.mattermost_adapter.send_message(channel_id, msg)
            except Exception as e:
                logger.warning("Đang bỏ qua thông báo Mattermost: %s", e)

            # Publish lifecycle event
            if self.event_bus:
                try:
                    await self.event_bus.publish_plugin_lifecycle(
                        action="installed",
                        tenant_id=str(context.tenant_id),
                        plugin_name=plugin_code_name,
                        plugin_version=manifest.version,
                    )
                except Exception as e:
                    logger.warning("Không thể publish event plugin.installed: %s", e)

            logger.info("Cài đặt plugin %s thành công.", plugin_code_name)

        except Exception as e:
            logger.error(
                "Plugin installation failed at step %s: %s",
                len(completed_steps) + 1,
                e,
                exc_info=True,
            )

            # Log lỗi vào step cuối
            if self._steps_log and self._steps_log[-1].get("status") == "RUNNING":
                last_step = self._steps_log[-1]["step"]
                self._log_step(last_step, "FAILED", str(e))

            # ROLLBACK
            await self._rollback(
                completed_steps, context, plugin_code_name, manifest, created_assets
            )

            # Update status to FAILED_DIRTY
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin.id,
                status=PluginStatus.FAILED_DIRTY,
                error_log=str(e),
            )
            try:
                await self.plugin_repo.update_install_steps_log(
                    tenant_id=context.tenant_id,
                    plugin_id=plugin.id,
                    steps_log=self._steps_log,
                )
            except Exception as log_err:
                logger.warning("Không thể lưu steps_log: %s", log_err)
            await self.session.commit()

            # Notify Mattermost (Best effort)
            try:
                msg = f"❌ Lỗi cài đặt Plugin **{manifest.display_name}**: {e}"
                channel_id = (
                    tenant.notify_channel_id or settings.MATTERMOST_SYSTEM_CHANNEL_ID
                    if tenant
                    else settings.MATTERMOST_SYSTEM_CHANNEL_ID
                )
                await self.mattermost_adapter.send_message(channel_id, msg)
            except Exception:
                pass

            # Publish failed lifecycle event
            if self.event_bus:
                try:
                    await self.event_bus.publish_plugin_lifecycle(
                        action="failed",
                        tenant_id=str(context.tenant_id),
                        plugin_name=plugin_code_name,
                        plugin_version=(
                            manifest.version if "manifest" in locals() else "unknown"
                        ),
                        extra_data={"error": str(e)},
                    )
                except Exception as ev_err:
                    logger.warning("Không thể publish event plugin.failed: %s", ev_err)

            raise PluginInstallError(f"Cài đặt plugin thất bại: {e}") from e

    async def _step_1_database(
        self, context: TenantContext, plugin_code_name: str, manifest: PluginManifest
    ) -> None:
        """Thực thi seed_file của plugin."""
        if manifest.database and manifest.database.seed_file:
            seed_path = (
                self.manifest_parser.plugins_dir
                / plugin_code_name
                / manifest.database.seed_file
            )
            if seed_path.exists():
                with open(seed_path, encoding="utf-8") as f:
                    sql = f.read()

                # Validation: Cấm các lệnh SQL nguy hiểm
                forbidden_pattern = re.compile(
                    r"\b(DROP|DELETE|UPDATE|TRUNCATE|ALTER|GRANT|REVOKE|COPY|"
                    r"CREATE\s+FUNCTION|SET\s+ROLE)\b",
                    re.IGNORECASE,
                )
                if forbidden_pattern.search(sql):
                    raise PluginInstallError(
                        "Seed file chứa các lệnh SQL không được phép."
                    )

                # Set search_path để sandbox SQL execution trong schema của Tenant
                schema_name = f"tenant_{context.tenant_id}".replace("-", "_")
                if not re.match(r"^[a-zA-Z0-9_]+$", schema_name):
                    raise PluginInstallError("Invalid schema name.")
                await self.session.execute(
                    text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
                )
                await self.session.execute(text(f'SET search_path TO "{schema_name}"'))

                # Setup RLS context cho tenant
                await self.session.execute(
                    text("SELECT set_config('role', 'tenant_admin', true)")
                )
                await self.session.execute(
                    text("SELECT set_config('app.current_tenant_id', :tid, true)"),
                    {"tid": str(context.tenant_id)},
                )

                # Execute raw SQL
                await self.session.execute(text(sql))
                # Không commit ở đây để dùng chung transaction hoặc commit tùy strategy
        # Chúng ta tạm thiết kế DB adapter bằng session execute.

    async def _step_2_n8n(
        self, context: TenantContext, plugin_code_name: str, manifest: PluginManifest
    ) -> list[str]:
        """Import workflows vào n8n."""
        workflow_ids = []
        for wf in manifest.workflows:
            wf_path = self.manifest_parser.plugins_dir / plugin_code_name / wf.file
            if wf_path.exists() and hasattr(self.n8n_adapter, "import_workflow"):
                with open(wf_path, encoding="utf-8") as f:
                    wf_json = json.load(f)

                wid = await self.n8n_adapter.import_workflow(wf_json)
                workflow_ids.append(wid)
        return workflow_ids

    async def _step_3_metabase(
        self, context: TenantContext, plugin_code_name: str, manifest: PluginManifest
    ) -> list[str]:
        """Import dashboards vào Metabase."""
        dashboard_ids = []
        for db in manifest.dashboards:
            db_path = self.manifest_parser.plugins_dir / plugin_code_name / db.file
            if db_path.exists() and hasattr(self.metabase_adapter, "create_dashboard"):
                with open(db_path, encoding="utf-8") as f:
                    db_json = json.load(f)
                did = await self.metabase_adapter.create_dashboard(db_json)
                dashboard_ids.append(did)
        return dashboard_ids

    async def _step_4_appsmith(
        self, context: TenantContext, plugin_code_name: str, manifest: PluginManifest
    ) -> list[str]:
        """Import UI apps vào Appsmith."""
        app_ids = []
        for app in manifest.ui_apps:
            app_path = self.manifest_parser.plugins_dir / plugin_code_name / app.file
            if app_path.exists() and hasattr(self.appsmith_adapter, "import_app"):
                with open(app_path, encoding="utf-8") as f:
                    app_json = json.load(f)
                aid = await self.appsmith_adapter.import_app(app_json)
                app_ids.append(aid)
        return app_ids

    async def _step_5_keycloak(
        self, context: TenantContext, plugin_code_name: str, manifest: PluginManifest
    ) -> list[str]:
        """Tạo Roles trong Keycloak."""
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

    async def _step_6_events(
        self, context: TenantContext, plugin_code_name: str, manifest: PluginManifest
    ) -> list[str]:
        """Tạo n8n webhooks cho Event Subscriptions."""
        registered_events = []
        for sub in manifest.event_subscriptions:
            # Dummy logic until event bus registry is fully spec'd
            registered_events.append(f"{sub.source_plugin}_{'-'.join(sub.event_types)}")
        return registered_events

    async def _step_7_credentials(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        credentials: list[CredentialInput],
    ) -> list[dict[str, str]]:
        """
        Bước 7: Tạo n8n Credentials từ danh sách được cung cấp bởi người dùng.
        Credentials được gửi sang n8n; không bao giờ lưu raw value vào DB Proteus.
        Trả về list của {"id": "n8n-id", "name": "safe_name"} để rollback.
        """
        # Build lookup map từ credentials_schema
        schema_map = {f.key: f for f in manifest.credentials_schema}
        created: list[dict[str, str]] = []

        for cred_input in credentials:
            schema_field = schema_map.get(cred_input.key)
            # Xác định credential_type_name
            cred_type = (
                cred_input.credential_type_name
                or (schema_field.credential_type_name if schema_field else None)
                or cred_input.key
            )
            safe_name = (
                f"tenant_{context.tenant_id}_{plugin_code_name}_{cred_input.key}"
            )

            if not hasattr(self.n8n_adapter, "create_credential"):
                logger.warning("n8n_adapter không có create_credential, bỏ qua.")
                continue

            try:
                result = await self.n8n_adapter.create_credential(
                    credential_type=cred_type,
                    credential_name=safe_name,
                    data={cred_input.key: cred_input.value},
                )
                created.append({"id": str(result.get("id", "")), "name": safe_name})
                logger.info(
                    "Tạo n8n credential '%s' cho plugin %s tenant %s",
                    safe_name,
                    plugin_code_name,
                    context.tenant_id,
                )
            except Exception as e:
                logger.error(
                    "Không thể tạo credential '%s': %s",
                    safe_name,
                    e,
                )
                raise PluginInstallError(
                    f"Tạo credential '{cred_input.key}' thất bại: {e}"
                ) from e

        return created

    def _check_version_compatibility(self, manifest: PluginManifest) -> None:
        """
        Kiểm tra compatibility: proteus_os_min_version.
        Nếu không đáp ứng → raise PluginInstallError.
        """
        min_ver_str = manifest.compatibility.proteus_os_min_version
        current_ver_str = getattr(settings, "PROTEUS_VERSION", "1.0.0")
        try:
            min_ver = tuple(int(x) for x in min_ver_str.split(".")[:3])
            current_ver = tuple(int(x) for x in current_ver_str.split(".")[:3])
            if current_ver < min_ver:
                raise PluginInstallError(
                    f"Plugin yêu cầu Proteus OS ≥ {min_ver_str}, "
                    f"phiên bản hiện tại là {current_ver_str}."
                )
        except PluginInstallError:
            raise
        except Exception:
            # Version parsing error → bỏ qua check (không fail install)
            logger.warning(
                "Không thể kiểm tra version compatibility: %s vs %s",
                min_ver_str,
                current_ver_str,
            )

    def _log_step(
        self,
        step_name: str,
        status: str,
        message: str | None = None,
    ) -> None:
        """Ghi một bước vào _steps_log (in-memory)."""
        now_iso = datetime.now(UTC).isoformat()
        # Cập nhật entry nếu cùng step_name
        for entry in self._steps_log:
            if entry["step"] == step_name:
                entry["status"] = status
                if message:
                    entry["message"] = message
                entry["at"] = now_iso
                return
        # Thêm mới
        self._steps_log.append(
            {
                "step": step_name,
                "status": status,
                "at": now_iso,
                "message": message,
            }
        )

    async def _persist_steps(
        self,
        context: TenantContext,
        plugin_id: uuid.UUID,
    ) -> None:
        """Lưu _steps_log hiện tại vào DB (best-effort, không raise)."""
        try:
            await self.plugin_repo.update_install_steps_log(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                steps_log=self._steps_log,
            )
        except Exception as e:
            logger.warning("Không thể persist steps_log: %s", e)

    async def _rollback(
        self,
        completed_steps: list[str],
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        created_assets: dict[str, list[str]],
    ) -> None:
        """Thực hiện compensating transactions."""
        logger.info("Bắt đầu rollback cài đặt plugin %s...", plugin_code_name)

        for step in reversed(completed_steps):
            try:
                if step == "events":
                    pass
                elif step == "keycloak":
                    if hasattr(self.keycloak_adapter, "delete_role"):
                        keycloak_realm = "proteus"
                        if self.tenant_repo:
                            tenant = await self.tenant_repo.get_by_id(context.tenant_id)
                            if tenant:
                                keycloak_realm = tenant.keycloak_realm

                        roles = created_assets.get("keycloak", [])
                        for role_name in reversed(roles):
                            await self.keycloak_adapter.delete_role(
                                realm=keycloak_realm,
                                role_name=role_name,
                            )
                elif step == "appsmith":
                    if hasattr(self.appsmith_adapter, "delete_app"):
                        app_ids = created_assets.get("appsmith", [])
                        for aid in reversed(app_ids):
                            await self.appsmith_adapter.delete_app(aid)
                elif step == "metabase":
                    if hasattr(self.metabase_adapter, "delete_dashboard"):
                        db_ids = created_assets.get("metabase", [])
                        for did in reversed(db_ids):
                            await self.metabase_adapter.delete_dashboard(did)
                elif step == "n8n":
                    if hasattr(self.n8n_adapter, "delete_workflow"):
                        wf_ids = created_assets.get("n8n", [])
                        for wid in reversed(wf_ids):
                            await self.n8n_adapter.delete_workflow(wid)
                elif step == "database":
                    if manifest.database and manifest.database.tables:
                        schema_name = f"tenant_{context.tenant_id}".replace("-", "_")
                        if not re.match(r"^[a-zA-Z0-9_]+$", schema_name):
                            continue
                        await self.session.execute(
                            text(f'SET search_path TO "{schema_name}"')
                        )
                        for table in reversed(manifest.database.tables):
                            if not re.match(r"^[a-zA-Z0-9_]+$", table):
                                continue
                            await self.session.execute(
                                text(f'DROP TABLE IF EXISTS "{table}" CASCADE')
                            )
            except Exception as e:
                logger.error(
                    "Rollback step %s thất bại cho plugin %s: %s",
                    step,
                    plugin_code_name,
                    e,
                )
        logger.info("Hoàn thành rollback cho %s.", plugin_code_name)

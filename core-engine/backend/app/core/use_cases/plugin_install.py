# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Plugin Install Use Case
# Xử lý 6 bước cài đặt Plugin theo mô hình Saga (Compensating Transaction).

import asyncio
import json
import random
import re
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import CredentialInput, PluginStatus, TenantContext
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

logger = structlog.get_logger(__name__)


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
        manifest_parser: AbstractManifestParserPort,
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
            "Bắt đầu cài đặt plugin",
            plugin_code_name=plugin_code_name,
            tenant_id=context.tenant_id,
        )

        # Reset state
        self._steps_log = []
        self._credential_ids = []
        # Asset thu thập DẦN trong từng step (kể cả khi step fail giữa chừng)
        # để rollback dọn được cả partial imports (trước đây chỉ lưu khi step
        # DONE nên workflow import dở bị mồ côi → trùng tên ở lần cài lại).
        created_assets_init: dict[str, list[str]] = {
            "n8n": [],
            "metabase": [],
            "appsmith": [],
            "keycloak": [],
            "events": [],
            "credentials": [],
        }

        # 1. Fetch plugin metadata and tenant
        plugin = await self.plugin_repo.get_by_code_name(plugin_code_name)
        tenant = None
        if getattr(self, "tenant_repo", None):
            tenant = await self.tenant_repo.get_by_id(context.tenant_id)

        if not plugin:
            raise PluginInstallError(
                f"Plugin '{plugin_code_name}' không tồn tại trên Marketplace."
            )

        # 2. Check if already installed or being removed.
        # NOTE: INSTALLING is intentionally excluded from this guard —
        # the HTTP endpoint sets status=INSTALLING before queuing this background task,
        # so blocking on INSTALLING would prevent the task from ever running.
        status = await self.plugin_repo.get_installation_status(
            context.tenant_id, plugin.id
        )
        if status == PluginStatus.ACTIVE:
            raise PluginInstallError(
                f"Plugin '{plugin_code_name}' đã được cài đặt và đang ACTIVE."
            )
        if status == PluginStatus.UNINSTALLING:
            raise PluginInstallError(
                f"Plugin '{plugin_code_name}' đang trong quá trình gỡ cài đặt, vui lòng thử lại sau."
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
        created_assets: dict[str, list[str]] = created_assets_init
        try:
            # BƯỚC 1: Database Setup
            logger.info(
                "Chạy bước cài đặt",
                step="database",
                status="RUNNING",
                plugin_code_name=plugin_code_name,
                tenant_id=context.tenant_id,
            )
            self._log_step("database", "RUNNING")
            await self._step_1_database(context, plugin_code_name, manifest)
            self._log_step("database", "DONE")
            logger.info(
                "Hoàn thành cài đặt",
                step="database",
                status="DONE",
                plugin_code_name=plugin_code_name,
                tenant_id=context.tenant_id,
            )
            completed_steps.append("database")
            await self._persist_steps(context, plugin.id)
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # BƯỚC 1.5: External Credentials (n8n)
            credential_mapping: dict[str, str] = {}
            if credentials:
                self._log_step("credentials", "RUNNING")
                cred_mapping, cred_assets = await self._step_1_5_credentials(
                    context, plugin_code_name, manifest, credentials
                )
                credential_mapping = cred_mapping
                created_assets["credentials"] = cred_assets
                self._log_step("credentials", "DONE")
                completed_steps.append("credentials")
                await self.plugin_repo.update_credential_ids(
                    context.tenant_id, plugin.id, created_assets["credentials"]
                )

            # BƯỚC 2: n8n Import (thu thập id dần vào created_assets
            # để fail giữa chừng vẫn rollback được partial imports)
            self._log_step("n8n", "RUNNING")
            n8n_ids = await self._step_2_n8n(
                context,
                plugin_code_name,
                manifest,
                credential_mapping,
                collected=created_assets["n8n"],
            )
            self._log_step("n8n", "DONE")
            completed_steps.append("n8n")
            await self._persist_steps(context, plugin.id)
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # BƯỚC 3: Metabase Import (thu thập dần như bước n8n)
            self._log_step("metabase", "RUNNING")
            mb_ids = await self._step_3_metabase(
                context,
                plugin_code_name,
                manifest,
                collected=created_assets["metabase"],
            )
            self._log_step("metabase", "DONE")
            completed_steps.append("metabase")
            await self._persist_steps(context, plugin.id)
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # BƯỚC 4: Appsmith Import (thu thập dần như bước n8n)
            self._log_step("appsmith", "RUNNING")
            app_ids = await self._step_4_appsmith(
                context,
                plugin_code_name,
                manifest,
                collected=created_assets["appsmith"],
            )
            self._log_step("appsmith", "DONE")
            completed_steps.append("appsmith")
            await self._persist_steps(context, plugin.id)
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # BƯỚC 5: Keycloak Roles
            self._log_step("keycloak", "RUNNING")
            roles = await self._step_5_keycloak(context, plugin_code_name, manifest)
            created_assets["keycloak"] = roles
            self._log_step("keycloak", "DONE")
            completed_steps.append("keycloak")
            await self._persist_steps(context, plugin.id)
            await asyncio.sleep(random.uniform(1.0, 3.0))

            # BƯỚC 6: Event Subscriptions
            self._log_step("events", "RUNNING")
            events = await self._step_6_events(context, plugin_code_name, manifest)
            created_assets["events"] = events
            self._log_step("events", "DONE")
            completed_steps.append("events")
            await self._persist_steps(context, plugin.id)
            await asyncio.sleep(random.uniform(1.0, 3.0))

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

            logger.info(
                "Cài đặt plugin thành công.",
                plugin_code_name=plugin_code_name,
                tenant_id=context.tenant_id,
            )

        except Exception as e:
            logger.error(
                "Plugin installation failed",
                step=len(completed_steps) + 1,
                error=str(e),
                plugin_code_name=plugin_code_name,
                tenant_id=context.tenant_id,
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

            # Reset session state trước khi update status:
            # 1. Rollback nếu session đang ở trạng thái lỗi (aborted transaction)
            # 2. Reset search_path về public (tránh bị kẹt ở tenant schema từ step 1)
            try:
                await self.session.rollback()
                await self.session.execute(text("SET search_path TO public"))
            except Exception as reset_err:
                logger.warning(
                    "Không thể reset session trước error handler: %s", reset_err
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
        """Thực thi seed_file của plugin và setup RLS."""
        if manifest.database:
            schema_name = f"tenant_{context.tenant_id}".replace("-", "_")
            if not re.match(r"^[a-zA-Z0-9_]+$", schema_name):
                raise PluginInstallError("Invalid schema name.")

            has_schema = False
            if manifest.database.seed_file:
                seed_path = (
                    self.manifest_parser.plugins_dir
                    / plugin_code_name
                    / manifest.database.seed_file
                )
                if seed_path.exists():
                    with open(seed_path, encoding="utf-8-sig") as f:
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

                    # Set search_path để sandbox SQL execution trong schema của Tenant.
                    # Giữ "public" thứ 2 để seed dùng được shared extensions
                    # (VD: public.uuid_generate_v4()) — unqualified CREATE vẫn
                    # rơi vào schema tenant vì nó đứng đầu.
                    await self.session.execute(
                        text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
                    )
                    await self.session.execute(
                        text(f'SET search_path TO "{schema_name}", public')
                    )
                    has_schema = True

                    # app.current_tenant_id được set tự động bởi after_begin event listener
                    # khi current_tenant_id contextvar được thiết lập trong background task.
                    # KHÔNG dùng set_config('role', ...) vì role 'tenant_admin' không tồn tại.

                    # asyncpg không hỗ trợ nhiều statement trong một execute().
                    # Phải split theo dấu ';' và execute từng câu một.
                    # Dùng SAVEPOINT cho từng câu để seed data fail không làm hỏng transaction.
                    statements = [s.strip() for s in sql.split(";") if s.strip()]
                    for i, stmt in enumerate(statements):
                        sp_name = f"seed_stmt_{i}"
                        try:
                            await self.session.execute(text(f"SAVEPOINT {sp_name}"))
                            await self.session.execute(text(stmt))
                            await self.session.execute(
                                text(f"RELEASE SAVEPOINT {sp_name}")
                            )
                        except Exception as stmt_err:
                            logger.warning(
                                "Seed statement %d failed (skipped): %s — %s",
                                i,
                                stmt[:80],
                                stmt_err,
                            )
                            await self.session.execute(
                                text(f"ROLLBACK TO SAVEPOINT {sp_name}")
                            )
                    # Reset search_path về public để tránh ảnh hưởng session tiếp theo
                    await self.session.execute(text("SET search_path TO public"))

            # Tự động tạo RLS cho các bảng (best-effort — table có thể chưa tồn tại)
            if manifest.database.tables:
                # BẮT BUỘC set search_path mọi lần: seed block đã reset về public,
                # nếu bỏ qua (chỉ set khi not has_schema) thì ALTER TABLE tìm sai
                # schema → "relation does not exist" và RLS không bao giờ được bật.
                await self.session.execute(
                    text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
                )
                await self.session.execute(
                    text(f'SET search_path TO "{schema_name}"')
                )

                # Role app_user phải tồn tại thì CREATE POLICY mới chạy được
                # (fresh install chưa có → tạo best-effort, đã có thì skip).
                await self.session.execute(text("SAVEPOINT rls_role"))
                try:
                    await self.session.execute(
                        text("CREATE ROLE app_user NOLOGIN")
                    )
                    await self.session.execute(text("RELEASE SAVEPOINT rls_role"))
                except Exception:
                    await self.session.execute(
                        text("ROLLBACK TO SAVEPOINT rls_role")
                    )

                # Chỉ bảng có cột tenant_id mới áp được policy (đa số bảng plugin
                # cách ly bằng schema-per-tenant, không có cột này → bỏ qua).
                res_cols = await self.session.execute(
                    text(
                        "SELECT table_name FROM information_schema.columns "
                        "WHERE table_schema = :schema AND column_name = 'tenant_id'"
                    ),
                    {"schema": schema_name},
                )
                tables_with_tenant = {r[0] for r in res_cols.fetchall()}

                for table in manifest.database.tables:
                    if not re.match(r"^[a-zA-Z0-9_]+$", table):
                        raise PluginInstallError(f"Invalid table name: {table}")
                    if table not in tables_with_tenant:
                        logger.debug(
                            "Bỏ qua RLS cho bảng %s (không có cột tenant_id; "
                            "cách ly bằng schema)",
                            table,
                        )
                        continue

                    sp = f"rls_{table}"
                    try:
                        await self.session.execute(text(f"SAVEPOINT {sp}"))
                        await self.session.execute(
                            text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
                        )
                        await self.session.execute(
                            text(
                                f'DROP POLICY IF EXISTS tenant_isolation_policy ON "{table}"'
                            )
                        )
                        policy_sql = f"""
                            CREATE POLICY tenant_isolation_policy ON "{table}"
                            FOR ALL TO app_user
                            USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
                            WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid)
                        """
                        await self.session.execute(text(policy_sql))
                        await self.session.execute(text(f"RELEASE SAVEPOINT {sp}"))
                    except Exception as rls_err:
                        logger.warning(
                            "RLS setup failed for table %s (skipped): %s",
                            table,
                            rls_err,
                        )
                        await self.session.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))

        # Chúng ta tạm thiết kế DB adapter bằng session execute.

    async def _step_2_n8n(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        credential_mapping: dict[str, str] = None,
        collected: list[str] | None = None,
    ) -> list[str]:
        """Import workflows vào n8n kèm Dynamic Workflow Injection."""
        workflow_ids = []

        # 1. Lấy Credential ID của ProteusDB_Real (Internal DB)
        proteus_db_cred_id = None
        if self.session:
            res = await self.session.execute(
                text(
                    "SELECT id FROM n8n.credentials_entity WHERE name = 'ProteusDB_Real' LIMIT 1"
                )
            )
            row = res.fetchone()
            if row:
                proteus_db_cred_id = row[0]

        # 1b. Đảm bảo credential Mattermost dùng chung (ProteusMM) để gắn vào
        # các node Mattermost. Thiếu nó workflow import được nhưng không
        # activate được ("Missing required credential: mattermostApi").
        proteus_mm_cred_id = None
        proteus_mm_cred_name = None
        if self.session:
            try:
                res = await self.session.execute(
                    text(
                        "SELECT id FROM n8n.credentials_entity WHERE name = 'ProteusMM' LIMIT 1"
                    )
                )
                row = res.fetchone()
                if row:
                    proteus_mm_cred_id = str(row[0])
                    proteus_mm_cred_name = "ProteusMM"
                elif settings.MATTERMOST_BOT_TOKEN:
                    created = await self.n8n_adapter.create_credential(
                        credential_type="mattermostApi",
                        credential_name="ProteusMM",
                        data={
                            "baseUrl": settings.MATTERMOST_URL,
                            "accessToken": settings.MATTERMOST_BOT_TOKEN,
                        },
                    )
                    proteus_mm_cred_id = str(created.get("id"))
                    proteus_mm_cred_name = "ProteusMM"
                    logger.info("Đã tạo n8n credential ProteusMM dùng chung")
            except Exception as e:
                logger.warning("Không đảm bảo được credential ProteusMM: %s", e)

        # 1c. Đảm bảo credential Ollama dùng chung (ProteusOllama) cho các node
        # AI (lmChatOllama...). File workflow mẫu thường mang credential ID cũ
        # của máy dev (VD: "OllamaLocal") → phải ghi đè, nếu không workflow lỗi
        # missing credential khi chạy.
        proteus_ollama_cred_id = None
        proteus_ollama_cred_name = None
        if self.session:
            try:
                res = await self.session.execute(
                    text(
                        "SELECT id FROM n8n.credentials_entity WHERE name = 'ProteusOllama' LIMIT 1"
                    )
                )
                row = res.fetchone()
                if row:
                    proteus_ollama_cred_id = str(row[0])
                    proteus_ollama_cred_name = "ProteusOllama"
                else:
                    ollama_base = (settings.LLM_BASE_URL or "").rstrip("/")
                    if ollama_base.endswith("/v1"):
                        ollama_base = ollama_base[: -len("/v1")]
                    if ollama_base:
                        created = await self.n8n_adapter.create_credential(
                            credential_type="ollamaApi",
                            credential_name="ProteusOllama",
                            data={"baseUrl": ollama_base},
                        )
                        proteus_ollama_cred_id = str(created.get("id"))
                        proteus_ollama_cred_name = "ProteusOllama"
                        logger.info("Đã tạo n8n credential ProteusOllama dùng chung")
            except Exception as e:
                logger.warning("Không đảm bảo được credential ProteusOllama: %s", e)

        tenant_schema = f"tenant_{str(context.tenant_id).replace('-', '_')}"

        # Kênh mặc định cho node Mattermost thiếu channelId (file mẫu thường bỏ
        # trống → n8n từ chối activate "Missing channelId").
        alerts_channel_id = None
        if self.tenant_repo is not None:
            try:
                from app.core.use_cases.tenant_onboarding import (
                    get_tenant_alerts_channel_id,
                )

                alerts_channel_id = await get_tenant_alerts_channel_id(
                    self.tenant_repo, self.mattermost_adapter,
                    context.tenant_id,
                )
            except Exception as e:
                logger.warning("Không resolve được alerts channel: %s", e)

        for wf in manifest.workflows:
            wf_path = self.manifest_parser.plugins_dir / plugin_code_name / wf.file
            if wf_path.exists():
                with open(wf_path, encoding="utf-8-sig") as f:
                    wf_json = json.load(f)

                # Dynamic Workflow Injection
                for node in wf_json.get("nodes", []):
                    # Inject Tenant Schema
                    if "parameters" in node and "query" in node["parameters"]:
                        query = node["parameters"]["query"]
                        if "{{TENANT_SCHEMA}}" in query:
                            node["parameters"]["query"] = query.replace(
                                "{{TENANT_SCHEMA}}", tenant_schema
                            )

                    # Auto-bind Credentials (Internal & External).
                    # credentials có thể là null (export từ n8n) → chuẩn hóa
                    # thành dict trước, nếu không setdefault crash AttributeError.
                    _ntype = (node.get("type") or "").lower()
                    _needs_creds = (
                        node.get("type") == "n8n-nodes-base.postgres"
                        or "mattermost" in _ntype
                        or "ollama" in _ntype
                    )
                    if _needs_creds and not isinstance(
                        node.get("credentials"), dict
                    ):
                        node["credentials"] = {}
                    # Postgres nodes thiếu skeleton credentials vẫn được gắn
                    # ProteusDB_Real để workflow import xong chạy được ngay.
                    if node.get("type") == "n8n-nodes-base.postgres":
                        node["credentials"].setdefault("postgres", {})
                    # Mattermost nodes (kể cả file cũ không khai credentials)
                    # được gắn ProteusMM dùng chung để activate được ngay.
                    # Node thiếu channelId được điền kênh alerts của tenant
                    # (file mẫu hay bỏ trống → n8n từ chối activate).
                    if "mattermost" in _ntype:
                        node["credentials"].setdefault(
                            "mattermostApi", {}
                        )
                        params = node.get("parameters")
                        if (
                            isinstance(params, dict)
                            and not params.get("channelId")
                            and alerts_channel_id
                        ):
                            params["channelId"] = alerts_channel_id
                        if proteus_mm_cred_id:
                            node["credentials"]["mattermostApi"]["id"] = (
                                proteus_mm_cred_id
                            )
                            node["credentials"]["mattermostApi"]["name"] = (
                                proteus_mm_cred_name
                            )
                    # Ollama/AI nodes: ghi đè credential ID cũ của máy dev
                    # (VD: "OllamaLocal") bằng ProteusOllama dùng chung.
                    if "ollama" in _ntype:
                        node["credentials"].setdefault(
                            "ollamaApi", {}
                        )
                        if proteus_ollama_cred_id:
                            node["credentials"]["ollamaApi"]["id"] = (
                                proteus_ollama_cred_id
                            )
                            node["credentials"]["ollamaApi"]["name"] = (
                                proteus_ollama_cred_name
                            )
                    if isinstance(node.get("credentials"), dict):
                        for cred_key, cred_val in node["credentials"].items():
                            # Internal DB (Proteus)
                            if (
                                node.get("type") == "n8n-nodes-base.postgres"
                                and cred_key == "postgres"
                                and proteus_db_cred_id
                            ):
                                node["credentials"][cred_key]["id"] = proteus_db_cred_id
                                node["credentials"][cred_key]["name"] = "ProteusDB_Real"
                            # External (e.g. gmailOAuth2) from user input
                            elif credential_mapping and cred_key in credential_mapping:
                                node["credentials"][cred_key]["id"] = (
                                    credential_mapping[cred_key]
                                )
                                node["credentials"][cred_key][
                                    "name"
                                ] = f"tenant_{context.tenant_id}_{plugin_code_name}_{cred_key}"

                wid = await self.n8n_adapter.import_workflow(wf_json)
                workflow_ids.append(wid)
                if collected is not None:
                    collected.append(wid)

                # Webhook/cron chỉ chạy khi workflow ACTIVE — bật ngay sau import.
                # Best-effort: activation fail thì warn (không fail cả install),
                # admin bật tay trong n8n UI (workflow.proteus.local) sau.
                try:
                    await self.n8n_adapter.activate_workflow(wid)
                except Exception as act_err:  # noqa: BLE001
                    logger.warning(
                        "Không activate được workflow %s (%s): %s",
                        wid,
                        wf.file,
                        act_err,
                    )
        return workflow_ids

    async def _step_3_metabase(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        collected: list[str] | None = None,
    ) -> list[str]:
        """Import dashboards vào Metabase."""
        dashboard_ids = []
        for db in manifest.dashboards:
            db_path = self.manifest_parser.plugins_dir / plugin_code_name / db.file
            if db_path.exists():
                with open(db_path, encoding="utf-8-sig") as f:
                    db_json = json.load(f)
                did = await self.metabase_adapter.import_dashboard(db_json)
                dashboard_ids.append(did)
                if collected is not None:
                    collected.append(str(did))
        return dashboard_ids

    async def _step_4_appsmith(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        collected: list[str] | None = None,
    ) -> list[str]:
        """Import UI apps vào Appsmith."""
        app_ids = []
        integration_config = None
        if self.tenant_repo and hasattr(
            self.tenant_repo, "get_integration_by_provider"
        ):
            integration = await self.tenant_repo.get_integration_by_provider(
                context.tenant_id, "appsmith"
            )
            if integration:
                integration_config = integration.config

        if manifest.ui and manifest.ui.appsmith_app:
            app_path = (
                self.manifest_parser.plugins_dir
                / plugin_code_name
                / manifest.ui.appsmith_app
            )
            if app_path.exists():
                with open(app_path, encoding="utf-8-sig") as f:
                    app_json = json.load(f)

                aid = await self.appsmith_adapter.import_application(
                    app_json, integration_config=integration_config
                )

                app_ids.append(aid)
                if collected is not None:
                    collected.append(str(aid))
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

    async def _step_1_5_credentials(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        credentials: list[CredentialInput],
    ) -> tuple[dict[str, str], list[str]]:
        """
        Bước 1.5: Tạo n8n Credentials từ danh sách được cung cấp.
        Nhóm các trường dữ liệu theo credential_type_name.
        Trả về (credential_mapping, list_of_created_asset_ids).
        credential_mapping có dạng: {"gmailOAuth2": "n8n_id_123"}
        """
        schema_map = {f.key: f for f in manifest.credentials_schema}

        # Group by credential_type_name
        grouped_creds = {}
        for cred_input in credentials:
            schema_field = schema_map.get(cred_input.key)
            cred_type = (
                cred_input.credential_type_name
                or (schema_field.credential_type_name if schema_field else None)
                or cred_input.key
            )
            if cred_type not in grouped_creds:
                grouped_creds[cred_type] = {}
            grouped_creds[cred_type][cred_input.key] = cred_input.value

        if not hasattr(self.n8n_adapter, "create_credential"):
            logger.warning("n8n_adapter không có create_credential, bỏ qua.")
            return {}, []

        credential_mapping: dict[str, str] = {}
        created_asset_ids: list[str] = []

        for cred_type, data in grouped_creds.items():
            safe_name = f"tenant_{str(context.tenant_id).replace('-', '_')}_{plugin_code_name}_{cred_type}"
            try:
                result = await self.n8n_adapter.create_credential(
                    credential_type=cred_type,
                    credential_name=safe_name,
                    data=data,
                )
                new_id = str(result.get("id", ""))
                if new_id:
                    credential_mapping[cred_type] = new_id
                    created_asset_ids.append(new_id)
                logger.info(
                    "Tạo n8n credential '%s' cho plugin %s tenant %s",
                    safe_name,
                    plugin_code_name,
                    context.tenant_id,
                )
            except Exception as e:
                logger.error("Không thể tạo credential '%s': %s", safe_name, e)

        return credential_mapping, created_asset_ids

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
        """Ghi một bước vào _steps_log (in-memory) và in ra console."""
        now_iso = datetime.now(UTC).isoformat()

        # In log rõ ràng ra console
        emoji = "⏳"
        if status == "DONE":
            emoji = "✅"
        elif status == "FAILED":
            emoji = "❌"

        msg_suffix = f" - {message}" if message else ""
        logger.info(f"{emoji} [INSTALL] Bước {step_name.upper()}: {status}{msg_suffix}")

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
        # In log rõ ràng ra console
        emoji = "⏳"
        if status == "DONE":
            emoji = "✅"
        elif status == "FAILED":
            emoji = "❌"

        msg_suffix = f" - {message}" if message else ""
        logger.info(f"{emoji} [INSTALL] Bước {step_name.upper()}: {status}{msg_suffix}")

    async def _persist_steps(
        self,
        context: TenantContext,
        plugin_id: uuid.UUID,
    ) -> None:
        """Lưu _steps_log hiện tại vào DB và commit ngay để status polling thấy được."""
        try:
            await self.plugin_repo.update_install_steps_log(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                steps_log=self._steps_log,
            )
            # Commit ngay để status endpoint thấy progress realtime
            await self.session.commit()
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
                        integration_config = None
                        if self.tenant_repo and hasattr(
                            self.tenant_repo, "get_integration_by_provider"
                        ):
                            integration = (
                                await self.tenant_repo.get_integration_by_provider(
                                    context.tenant_id, "appsmith"
                                )
                            )
                            if integration:
                                integration_config = integration.config

                        app_ids = created_assets.get("appsmith", [])
                        for aid in reversed(app_ids):
                            await self.appsmith_adapter.delete_application(
                                aid, integration_config=integration_config
                            )
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
                        try:
                            await self.session.execute(
                                text(f'SET search_path TO "{schema_name}"')
                            )
                            for table in reversed(manifest.database.tables):
                                if not re.match(r"^[a-zA-Z0-9_]+$", table):
                                    continue
                                await self.session.execute(
                                    text(f'DROP TABLE IF EXISTS "{table}" CASCADE')
                                )
                        finally:
                            await self.session.execute(
                                text("SET search_path TO public")
                            )
                elif step == "credentials":
                    if hasattr(self.n8n_adapter, "delete_credential"):
                        for cred in getattr(self, "_credential_ids", []):
                            try:
                                await self.n8n_adapter.delete_credential(cred["id"])
                                logger.info(
                                    "Rollback: Deleted n8n credential %s", cred["name"]
                                )
                            except Exception as e:
                                logger.error(
                                    "Rollback credential %s failed: %s", cred["id"], e
                                )
            except Exception as e:
                logger.error(
                    "Rollback step %s thất bại cho plugin %s: %s",
                    step,
                    plugin_code_name,
                    e,
                )
        logger.info("Hoàn thành rollback cho %s.", plugin_code_name)

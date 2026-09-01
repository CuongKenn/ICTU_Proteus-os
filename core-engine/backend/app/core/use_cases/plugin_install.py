# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Plugin Install Use Case
# Xử lý 6 bước cài đặt Plugin theo mô hình Saga (Compensating Transaction).

import json
import logging
import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.appsmith_adapter import AppsmithAdapter
from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.external.local_manifest_parser import LocalManifestParser
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.external.metabase_adapter import MetabaseAdapter
from app.adapters.external.n8n_adapter import N8nAdapter
from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginStatus, TenantContext
from app.core.domain.plugin_manifest import PluginManifest
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
        n8n_adapter: N8nAdapter,
        metabase_adapter: MetabaseAdapter,
        appsmith_adapter: AppsmithAdapter,
        keycloak_adapter: KeycloakAdapter,
        mattermost_adapter: MattermostAdapter,
        session: AsyncSession,
        tenant_repo=None,  # Added for backwards compatibility during refactor
    ) -> None:
        self.plugin_repo = plugin_repo
        self.manifest_parser = manifest_parser
        self.n8n_adapter = n8n_adapter
        self.metabase_adapter = metabase_adapter
        self.appsmith_adapter = appsmith_adapter
        self.keycloak_adapter = keycloak_adapter
        self.mattermost_adapter = mattermost_adapter
        self.session = session
        self.tenant_repo = tenant_repo

    async def execute(self, context: TenantContext, plugin_code_name: str) -> None:
        logger.info(
            "Bắt đầu cài đặt plugin %s cho tenant %s",
            plugin_code_name,
            context.tenant_id,
        )

        # 1. Fetch plugin metadata
        plugin = await self.plugin_repo.get_by_code_name(plugin_code_name)
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

        # 4. Mark as INSTALLING
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
            await self._step_1_database(context, plugin_code_name, manifest)
            completed_steps.append("database")

            # BƯỚC 2: n8n Import
            n8n_ids = await self._step_2_n8n(context, plugin_code_name, manifest)
            created_assets["n8n"] = n8n_ids
            completed_steps.append("n8n")

            # BƯỚC 3: Metabase Import
            mb_ids = await self._step_3_metabase(context, plugin_code_name, manifest)
            created_assets["metabase"] = mb_ids
            completed_steps.append("metabase")

            # BƯỚC 4: Appsmith Import
            app_ids = await self._step_4_appsmith(context, plugin_code_name, manifest)
            created_assets["appsmith"] = app_ids
            completed_steps.append("appsmith")

            # BƯỚC 5: Keycloak Roles
            roles = await self._step_5_keycloak(context, plugin_code_name, manifest)
            created_assets["keycloak"] = roles
            completed_steps.append("keycloak")

            # BƯỚC 6: Event Subscriptions
            events = await self._step_6_events(context, plugin_code_name, manifest)
            created_assets["events"] = events
            completed_steps.append("events")

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
            await self.session.commit()

            # Notify Mattermost (Best effort)
            try:
                msg = (
                    f"✅ Đã cài đặt thành công Plugin "
                    f"**{manifest.display_name}** ({manifest.version})."
                )
                # TODO: get tenant's notify channel from config
                await self.mattermost_adapter.send_message(
                    settings.MATTERMOST_SYSTEM_CHANNEL_ID, msg
                )
            except Exception as e:
                logger.warning("Không thể gửi thông báo Mattermost: %s", e)

            logger.info("Cài đặt plugin %s thành công.", plugin_code_name)

        except Exception as e:
            logger.error(
                "Plugin installation failed at step %s: %s",
                len(completed_steps) + 1,
                e,
                exc_info=True,
            )

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
            await self.session.commit()

            # Notify Mattermost (Best effort)
            try:
                msg = f"❌ Lỗi cài đặt Plugin **{manifest.display_name}**: {e}"
                await self.mattermost_adapter.send_message(
                    settings.MATTERMOST_SYSTEM_CHANNEL_ID, msg
                )
            except Exception:
                pass

            raise PluginInstallError(f"Cài đặt plugin thất bại: {e}") from e

    async def _step_1_database(
        self, context: TenantContext, plugin_code_name: str, manifest: PluginManifest
    ) -> None:
        """Thực thi seed_file của plugin."""
        if manifest.database and manifest.database.seed_file:
            seed_path = (
                self.manifest_parser._plugins_dir
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
                await self.session.execute(text("SELECT set_config('role', 'tenant_admin', true)"))
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
            wf_path = self.manifest_parser._plugins_dir / plugin_code_name / wf.file
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
            db_path = self.manifest_parser._plugins_dir / plugin_code_name / db.file
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
            app_path = self.manifest_parser._plugins_dir / plugin_code_name / app.file
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
                        roles = created_assets.get("keycloak", [])
                        for role_name in reversed(roles):
                            await self.keycloak_adapter.delete_role(
                                realm="proteus",
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

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Plugin Uninstall Use Case (6-step reverse)

import logging
import uuid

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


class PluginUninstallError(Exception):
    """Lỗi nghiệp vụ khi gỡ cài đặt Plugin."""

    pass


class PluginUninstallUseCase:
    """
    Điều phối việc gỡ cài đặt plugin theo 6 bước ngược lại (Saga pattern).
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
    ) -> None:
        self.plugin_repo = plugin_repo
        self.manifest_parser = manifest_parser
        self.n8n_adapter = n8n_adapter
        self.metabase_adapter = metabase_adapter
        self.appsmith_adapter = appsmith_adapter
        self.keycloak_adapter = keycloak_adapter
        self.mattermost_adapter = mattermost_adapter
        self.session = session

    async def uninstall_plugin(
        self, context: TenantContext, plugin_id: uuid.UUID, confirm_name: str
    ) -> None:
        # Lấy thông tin plugin
        plugin = await self.plugin_repo.get_by_id(plugin_id)
        if not plugin:
            raise PluginUninstallError("Plugin không tồn tại trong hệ thống.")

        if plugin.status is None:
            raise PluginUninstallError(
                "Plugin này chưa được cài đặt hoặc không có quyền."
            )

        if confirm_name != plugin.code_name:
            raise PluginUninstallError(
                "Tên xác nhận không khớp với mã plugin (code_name)."
            )

        # Lấy code_name
        plugin_code_name = plugin.code_name
        try:
            manifest = self.manifest_parser.parse(plugin_code_name)
        except FileNotFoundError:
            raise PluginUninstallError(
                f"Không tìm thấy thư mục plugin: {plugin_code_name}"
            )
        except Exception as e:
            raise PluginUninstallError(f"Lỗi đọc manifest plugin: {e}")

        # Update status -> UNINSTALLING
        await self.plugin_repo.update_status(
            tenant_id=context.tenant_id,
            plugin_id=plugin.id,
            status=PluginStatus.UNINSTALLING,
        )
        await self.session.commit()

        config_override = await self.plugin_repo.get_config(
            tenant_id=context.tenant_id, plugin_id=plugin.id
        )

        # Thực hiện 6 bước ngược
        completed_steps: list[str] = []

        try:
            # BƯỚC 1: Xóa Event Subscriptions
            await self._step_1_events(
                context, plugin_code_name, manifest, config_override.get("events", [])
            )
            completed_steps.append("subscriptions")

            # BƯỚC 2: Xóa Keycloak Roles
            await self._step_2_keycloak(
                context, plugin_code_name, manifest, config_override.get("keycloak", [])
            )
            completed_steps.append("keycloak")

            # BƯỚC 3: Xóa Appsmith Apps
            await self._step_3_appsmith(
                context, plugin_code_name, manifest, config_override.get("appsmith", [])
            )
            completed_steps.append("appsmith")

            # BƯỚC 4: Xóa Metabase Dashboards
            await self._step_4_metabase(
                context, plugin_code_name, manifest, config_override.get("metabase", [])
            )
            completed_steps.append("metabase")

            # BƯỚC 5: Xóa n8n Workflows
            await self._step_5_n8n(
                context, plugin_code_name, manifest, config_override.get("n8n", [])
            )
            completed_steps.append("n8n")

            # BƯỚC 6: Drop Database Tables
            await self._step_6_database(context, plugin_code_name, manifest)
            completed_steps.append("db")

            # Xóa hẳn (hoặc soft-delete / update status DELETED)
            # Theo Requirement: Status -> DELETED khi thành công
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin.id,
                status=PluginStatus.DELETED,
            )
            await self.session.commit()

            # Notify Mattermost
            try:
                msg = f"🗑 Đã GỠ CÀI ĐẶT thành công Plugin **{manifest.display_name}**."
                await self.mattermost_adapter.send_message(
                    settings.MATTERMOST_SYSTEM_CHANNEL_ID, msg
                )
            except Exception:
                pass

        except Exception as e:
            logger.error(
                "Plugin uninstallation failed after steps %s: %s",
                completed_steps,
                e,
                exc_info=True,
            )

            # Nếu lỗi, ta mark là FAILED_DIRTY để admin hoặc job cleanup xử lý
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin.id,
                status=PluginStatus.FAILED_DIRTY,
                error_log=str(e),
            )
            await self.session.commit()

            try:
                msg = f"❌ Lỗi khi gỡ cài đặt Plugin **{manifest.display_name}**: {e}"
                await self.mattermost_adapter.send_message(
                    settings.MATTERMOST_SYSTEM_CHANNEL_ID, msg
                )
            except Exception:
                pass

            raise PluginUninstallError(f"Gỡ cài đặt plugin thất bại: {e}")

    async def _step_1_events(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        asset_ids: list[str],
    ) -> None:
        """Xóa webhooks từ n8n."""
        for sub in manifest.event_subscriptions:
            # await self.n8n_adapter.delete_webhook(context.tenant_id, plugin_code_name, sub)
            pass

    async def _step_2_keycloak(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        asset_ids: list[str],
    ) -> None:
        """Xóa roles khỏi Keycloak."""
        for role in manifest.roles:
            # Lấy admin token
            try:
                await self.keycloak_adapter.delete_role(
                    realm="proteus",
                    role_name=role.name,
                )
            except Exception as e:
                logger.warning("Không thể xóa role %s trong Keycloak: %s", role.name, e)

    async def _step_3_appsmith(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        asset_ids: list[str],
    ) -> None:
        """Xóa UI apps khỏi Appsmith."""
        for app_id in asset_ids:
            if hasattr(self.appsmith_adapter, "delete_app"):
                try:
                    await self.appsmith_adapter.delete_app(app_id)
                except Exception as e:
                    logger.warning("Không thể xóa Appsmith app %s: %s", app_id, e)

    async def _step_4_metabase(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        asset_ids: list[str],
    ) -> None:
        """Xóa Dashboards khỏi Metabase."""
        for db_id in asset_ids:
            if hasattr(self.metabase_adapter, "delete_dashboard"):
                try:
                    await self.metabase_adapter.delete_dashboard(db_id)
                except Exception as e:
                    logger.warning("Không thể xóa Metabase dashboard %s: %s", db_id, e)

    async def _step_5_n8n(
        self,
        context: TenantContext,
        plugin_code_name: str,
        manifest: PluginManifest,
        asset_ids: list[str],
    ) -> None:
        """Xóa workflows khỏi n8n."""
        for wf_id in asset_ids:
            if hasattr(self.n8n_adapter, "delete_workflow"):
                try:
                    await self.n8n_adapter.delete_workflow(wf_id)
                except Exception as e:
                    logger.warning("Không thể xóa n8n workflow %s: %s", wf_id, e)

    async def _step_6_database(
        self, context: TenantContext, plugin_code_name: str, manifest: PluginManifest
    ) -> None:
        """DROP Tables thuộc plugin (destructive)."""
        import re

        if manifest.database and manifest.database.tables:
            schema_name = f"tenant_{context.tenant_id}".replace("-", "_")
            await self.session.execute(text(f"SET search_path TO {schema_name}"))
            for table_name in manifest.database.tables:
                if not re.match(r"^[a-zA-Z0-9_]+$", table_name):
                    logger.warning(
                        f"Bỏ qua DROP TABLE vì tên bảng không hợp lệ: {table_name}"
                    )
                    continue
                drop_sql = f'DROP TABLE IF EXISTS "{table_name}" CASCADE;'
                try:
                    await self.session.execute(text(drop_sql))
                except Exception as e:
                    logger.error("Lỗi khi drop table %s: %s", table_name, e)
                    raise

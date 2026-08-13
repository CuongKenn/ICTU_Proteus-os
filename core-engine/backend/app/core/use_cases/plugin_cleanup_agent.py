# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.appsmith_adapter import AppsmithAdapter
from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.external.local_manifest_parser import LocalManifestParser
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.external.metabase_adapter import MetabaseAdapter
from app.adapters.external.n8n_adapter import N8nAdapter
from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import TenantContext
from app.core.use_cases.plugin_uninstall import PluginUninstallUseCase

logger = logging.getLogger(__name__)


class PluginCleanupAgent:
    """
    Background job chạy định kỳ (APScheduler) để dọn dẹp các Plugin
    bị kẹt ở trạng thái FAILED_DIRTY.
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
        self.mattermost_adapter = mattermost_adapter
        self.uninstall_use_case = PluginUninstallUseCase(
            plugin_repo=plugin_repo,
            manifest_parser=manifest_parser,
            n8n_adapter=n8n_adapter,
            metabase_adapter=metabase_adapter,
            appsmith_adapter=appsmith_adapter,
            keycloak_adapter=keycloak_adapter,
            mattermost_adapter=mattermost_adapter,
            session=session,
        )

    async def run(self) -> None:
        logger.info("Plugin Cleanup Agent bắt đầu quét các plugin bị kẹt FAILED_DIRTY.")
        failed_plugins = await self.plugin_repo.get_failed_dirty_plugins()

        if not failed_plugins:
            logger.info("Không có plugin nào cần dọn dẹp.")
            return

        for tenant_id, plugin_id, plugin_code_name in failed_plugins:
            logger.info(
                "Đang dọn dẹp plugin %s cho tenant %s", plugin_code_name, tenant_id
            )
            context = TenantContext(
                tenant_id=tenant_id,
                user_id=uuid.uuid4(),  # System User
                roles=["superadmin"],  # Bypass permissions
                full_name="SYSTEM_AGENT",
            )
            try:
                # Forced uninstall ignoring failures inside uninstall_plugin
                await self.uninstall_use_case.uninstall_plugin(
                    context=context,
                    plugin_id=plugin_id,
                    confirm_name=plugin_code_name,
                )
                logger.info(
                    "Đã dọn dẹp thành công",
                    extra={
                        "action": "audit_log",
                        "actor_type": "SYSTEM",
                        "tenant_id": str(tenant_id),
                        "plugin_id": str(plugin_id),
                    },
                )
                # Gửi thông báo Mattermost
                await self.mattermost_adapter.send_notification(
                    message=f"Plugin {plugin_code_name} đã được dọn dẹp khỏi Tenant {tenant_id}.",
                    channel_id="admin-channel",
                )
            except Exception as e:
                logger.error(
                    "Cleanup thất bại cho plugin %s", plugin_code_name,
                    exc_info=True,
                    extra={
                        "tenant_id": str(tenant_id),
                        "plugin_id": str(plugin_id),
                        "error": str(e),
                    },
                )
                await self.mattermost_adapter.send_notification(
                    message=f"CRITICAL ALERT: Plugin Cleanup Agent thất bại khi dọn dẹp plugin {plugin_code_name} cho Tenant {tenant_id}. Lỗi: {str(e)}",
                    channel_id="admin-channel",
                )

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
from app.infrastructure.config import settings

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
            try:
                await self.mattermost_adapter.send_interactive_message(
                    channel_id=settings.MATTERMOST_SYSTEM_CHANNEL_ID,
                    text=f"Plugin {plugin_code_name} (Tenant {tenant_id}) bị kẹt FAILED_DIRTY > 1 giờ. Cần thủ công gỡ cài đặt.",
                    action_id=str(plugin_id),
                    extra_context={
                        "tenant_id": str(tenant_id),
                        "action_type": "plugin_cleanup",
                    },
                )
                logger.warning(
                    "Plugin %s on tenant %s flagged for manual cleanup",
                    plugin_code_name,
                    tenant_id,
                )
            except Exception as e:
                logger.error(
                    "Cleanup warning thất bại cho plugin %s: %s", plugin_code_name, e
                )
                await self.mattermost_adapter.send_message(
                    text=f"CRITICAL ALERT: Plugin Cleanup Agent thất bại khi dọn dẹp plugin {plugin_code_name} cho Tenant {tenant_id}. Lỗi: {str(e)}",
                    channel_id=settings.MATTERMOST_SYSTEM_CHANNEL_ID,
                )

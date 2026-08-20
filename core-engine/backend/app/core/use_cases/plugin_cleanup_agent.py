# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging

from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.repositories.base import AbstractPluginRepository
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
        mattermost_adapter: MattermostAdapter,
    ) -> None:
        self.plugin_repo = plugin_repo
        self.mattermost_adapter = mattermost_adapter

    async def run(self) -> None:
        logger.info("Plugin Cleanup Agent bắt đầu quét các plugin bị kẹt FAILED_DIRTY.")
        failed_plugins = await self.plugin_repo.get_failed_dirty_plugins()

        if not failed_plugins:
            logger.info("Không có plugin nào cần dọn dẹp.")
            return

        for tenant_id, plugin_id, plugin_code_name in failed_plugins:
            try:
                # Chỉ gửi cảnh báo, để Admin quyết định
                await self.mattermost_adapter.send_interactive_message(
                    channel_id=settings.MATTERMOST_SYSTEM_CHANNEL_ID,
                    text=f"Plugin {plugin_code_name} (Tenant {tenant_id}) bị kẹt FAILED_DIRTY > 1 giờ. Cần thủ công gỡ cài đặt.",
                    action_id=str(plugin_id),
                    extra_context={"tenant_id": str(tenant_id), "action_type": "plugin_cleanup"}
                )
                logger.warning("Plugin %s on tenant %s flagged for manual cleanup", plugin_code_name, tenant_id)
            except Exception as e:
                logger.error(
                    "Gửi cảnh báo cleanup thất bại cho plugin %s",
                    plugin_code_name,
                    exc_info=True,
                    extra={
                        "tenant_id": str(tenant_id),
                        "plugin_id": str(plugin_id),
                        "error": str(e),
                    },
                )

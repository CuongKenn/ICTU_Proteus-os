# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
import uuid

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginStatus, TenantContext

logger = logging.getLogger(__name__)


class PluginToggleError(Exception):
    pass


class PluginToggleUseCase:
    def __init__(self, plugin_repo: AbstractPluginRepository) -> None:
        self.plugin_repo = plugin_repo

    async def disable_plugin(
        self, context: TenantContext, plugin_id: uuid.UUID
    ) -> None:
        """
        Tạm vô hiệu hóa Plugin đang hoạt động.
        """
        logger.info(
            "Disabling plugin",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )
        plugin = await self.plugin_repo.get_by_id(plugin_id)
        if not plugin:
            raise PluginToggleError("Plugin không tồn tại.")

        status = await self.plugin_repo.get_installation_status(
            context.tenant_id, plugin_id
        )
        if status != PluginStatus.ACTIVE:
            raise PluginToggleError("Plugin không ở trạng thái ACTIVE để vô hiệu hóa.")

        await self.plugin_repo.update_status(
            tenant_id=context.tenant_id,
            plugin_id=plugin_id,
            status=PluginStatus.DISABLED,
        )
        logger.info(
            "Plugin disabled successfully",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )

    async def enable_plugin(self, context: TenantContext, plugin_id: uuid.UUID) -> None:
        """
        Bật lại Plugin đã bị vô hiệu hóa.
        """
        logger.info(
            "Enabling plugin",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )
        plugin = await self.plugin_repo.get_by_id(plugin_id)
        if not plugin:
            raise PluginToggleError("Plugin không tồn tại.")

        status = await self.plugin_repo.get_installation_status(
            context.tenant_id, plugin_id
        )
        if status != PluginStatus.DISABLED:
            raise PluginToggleError("Plugin không ở trạng thái DISABLED để bật lại.")

        await self.plugin_repo.update_status(
            tenant_id=context.tenant_id,
            plugin_id=plugin_id,
            status=PluginStatus.ACTIVE,
        )
        logger.info(
            "Plugin enabled successfully",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )

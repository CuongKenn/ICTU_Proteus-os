# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from __future__ import annotations

import logging
import uuid

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginEntity

logger = logging.getLogger(__name__)


class PluginListUseCase:
    """
    Use Case: Lấy danh sách plugins.
    Xử lý logic nghiệp vụ liên quan đến việc liệt kê plugin trên marketplace hoặc plugin đã cài.
    """

    def __init__(self, plugin_repo: AbstractPluginRepository):
        self.plugin_repo = plugin_repo

    async def list_marketplace(
        self, limit: int = 20, offset: int = 0
    ) -> tuple[list[PluginEntity], int]:
        """Liệt kê tất cả Plugin trên Marketplace."""
        logger.info(f"Listing marketplace plugins (limit={limit}, offset={offset})")
        return await self.plugin_repo.list_marketplace(limit=limit, offset=offset)

    async def list_installed(
        self, tenant_id: uuid.UUID
    ) -> tuple[list[PluginEntity], int]:
        """Liệt kê Plugin đã cài đặt của một Tenant."""
        logger.info(f"Listing installed plugins for tenant {tenant_id}")
        return await self.plugin_repo.list_installed(tenant_id=tenant_id)

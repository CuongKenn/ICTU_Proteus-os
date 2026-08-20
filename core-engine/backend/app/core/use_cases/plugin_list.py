# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from __future__ import annotations

import logging
import uuid

from app.adapters.external.local_manifest_parser import LocalManifestParser
from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginEntity

logger = logging.getLogger(__name__)


class PluginListUseCase:
    """
    Use Case: Lấy danh sách plugins.
    Xử lý logic nghiệp vụ liên quan đến việc liệt kê plugin trên marketplace hoặc plugin đã cài.
    """

    def __init__(self, plugin_repo: AbstractPluginRepository, manifest_parser: LocalManifestParser):
        self.plugin_repo = plugin_repo
        self.manifest_parser = manifest_parser

    def _enrich_plugin_with_manifest(self, plugin: PluginEntity) -> PluginEntity:
        try:
            manifest = self.manifest_parser.parse(plugin.code_name)
            plugin.tables_count = len(manifest.database.tables) if manifest.database and manifest.database.tables else 0
            plugin.workflows_count = len(manifest.workflows) if manifest.workflows else 0
            plugin.roles = manifest.roles if manifest.roles else []
        except Exception as e:
            logger.warning("Không thể parse manifest cho plugin %s: %s", plugin.code_name, e)
        return plugin

    async def list_marketplace(
        self, limit: int = 20, offset: int = 0
    ) -> tuple[list[PluginEntity], int]:
        """Liệt kê tất cả Plugin trên Marketplace."""
        logger.info("Listing marketplace plugins (limit=%s, offset=%s)", limit, offset)
        plugins, total = await self.plugin_repo.list_marketplace(limit=limit, offset=offset)
        enriched_plugins = [self._enrich_plugin_with_manifest(p) for p in plugins]
        return enriched_plugins, total

    async def list_installed(
        self, tenant_id: uuid.UUID
    ) -> tuple[list[PluginEntity], int]:
        """Liệt kê Plugin đã cài đặt của một Tenant."""
        logger.info("Listing installed plugins for tenant %s", tenant_id)
        plugins, total = await self.plugin_repo.list_installed(tenant_id=tenant_id)
        enriched_plugins = [self._enrich_plugin_with_manifest(p) for p in plugins]
        return enriched_plugins, total

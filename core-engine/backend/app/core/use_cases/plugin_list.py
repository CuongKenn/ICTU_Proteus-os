# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from __future__ import annotations

import logging
import uuid
from urllib.parse import urlparse, urlunparse

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginEntity
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


def public_plugin_url(raw_url: str | None, code_name: str) -> str | None:
    """Dựng external_url public cho plugin theo môi trường deploy.

    Manifest hardcode URL local dev (http://plugins.proteus.local/...) → ở
    production gây DNS fail + Mixed Content khi nhúng iframe. Hàm này giữ path
    của manifest nhưng thay scheme+host bằng PLUGINS_MFE_URL hiện tại.
    """
    base = settings.PLUGINS_MFE_URL.rstrip("/")
    if not raw_url:
        return f"{base}/{code_name}"
    try:
        parts = urlparse(raw_url)
        if not parts.netloc:
            return f"{base}/{raw_url.lstrip('/')}"
        b = urlparse(base)
        return urlunparse((b.scheme, b.netloc, parts.path or f"/{code_name}", "", "", ""))
    except Exception:
        return raw_url


class PluginListUseCase:
    """
    Use Case: Lấy danh sách plugins.
    Xử lý logic nghiệp vụ liên quan đến việc liệt kê plugin trên marketplace hoặc plugin đã cài.
    """

    def __init__(self, plugin_repo: AbstractPluginRepository):
        self.plugin_repo = plugin_repo
        from app.adapters.external.local_manifest_parser import LocalManifestParser

        self.manifest_parser = LocalManifestParser()

    async def list_marketplace(
        self, limit: int = 20, offset: int = 0
    ) -> tuple[list[PluginEntity], int]:
        """Liệt kê tất cả Plugin trên Marketplace."""
        logger.info("Listing marketplace plugins (limit=%s, offset=%s)", limit, offset)
        plugins, total = await self.plugin_repo.list_marketplace(
            limit=limit, offset=offset
        )
        self._enrich_with_manifest(plugins)
        return plugins, total

    async def list_installed(
        self, tenant_id: uuid.UUID
    ) -> tuple[list[PluginEntity], int]:
        """Liệt kê Plugin đã cài đặt của một Tenant."""
        logger.info("Listing installed plugins for tenant %s", tenant_id)
        plugins, total = await self.plugin_repo.list_installed(tenant_id=tenant_id)
        self._enrich_with_manifest(plugins)
        return plugins, total

    def _enrich_with_manifest(self, plugins: list[PluginEntity]) -> None:
        """Enrich plugin entities with data from manifest.yaml"""
        for plugin in plugins:
            try:
                manifest = self.manifest_parser.parse(plugin.code_name)
                plugin.tables_count = (
                    len(manifest.database.tables) if manifest.database else 0
                )
                plugin.workflows_count = len(manifest.workflows)
                plugin.roles = [r.name for r in manifest.roles]
                if manifest.ui:
                    plugin.external_url = public_plugin_url(
                        manifest.ui.external_url, plugin.code_name
                    )
            except Exception as e:
                logger.warning(
                    "Failed to load manifest for %s: %s", plugin.code_name, e
                )

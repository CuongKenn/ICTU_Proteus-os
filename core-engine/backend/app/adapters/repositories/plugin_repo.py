# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Plugin Repository (SQLAlchemy implementation)
# Đây là phần "Adapter" của Hexagonal Architecture.
# Implement AbstractPluginRepository bằng SQLAlchemy.

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginEntity, PluginStatus

logger = logging.getLogger(__name__)


class SQLAlchemyPluginRepository(AbstractPluginRepository):
    """Adapter: Implement Plugin Repository dùng SQLAlchemy + PostgreSQL."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, plugin_id: uuid.UUID) -> PluginEntity | None:
        logger.debug("Fetching plugin by id", extra={"plugin_id": str(plugin_id)})
        result = await self._session.execute(
            text("SELECT * FROM plugins WHERE id = :id AND deleted_at IS NULL"),
            {"id": plugin_id},
        )
        row = result.mappings().first()
        if not row:
            return None
        return self._to_entity(dict(row))

    async def list_marketplace(
        self, limit: int = 20, offset: int = 0
    ) -> tuple[list[PluginEntity], int]:
        count_result = await self._session.execute(
            text("SELECT COUNT(*) FROM plugins WHERE deleted_at IS NULL")
        )
        total = count_result.scalar() or 0

        result = await self._session.execute(
            text(
                "SELECT * FROM plugins WHERE deleted_at IS NULL "
                "ORDER BY is_official DESC, download_count DESC "
                "LIMIT :limit OFFSET :offset"
            ),
            {"limit": limit, "offset": offset},
        )
        plugins = [self._to_entity(dict(row)) for row in result.mappings()]
        return plugins, total

    async def list_installed(
        self, tenant_id: uuid.UUID
    ) -> tuple[list[PluginEntity], int]:
        count_result = await self._session.execute(
            text(
                "SELECT COUNT(*) FROM tenant_plugins tp "
                "JOIN plugins p ON p.id = tp.plugin_id "
                "WHERE tp.tenant_id = :tenant_id AND tp.status = 'ACTIVE' "
                "AND p.deleted_at IS NULL"
            ),
            {"tenant_id": tenant_id},
        )
        total = count_result.scalar() or 0

        result = await self._session.execute(
            text(
                "SELECT p.*, tp.status "
                "FROM plugins p "
                "JOIN tenant_plugins tp ON tp.plugin_id = p.id "
                "WHERE tp.tenant_id = :tenant_id AND tp.status = 'ACTIVE' "
                "AND p.deleted_at IS NULL"
            ),
            {"tenant_id": tenant_id},
        )
        plugins = [self._to_entity(dict(row)) for row in result.mappings()]
        return plugins, total

    async def get_installation_status(
        self, tenant_id: uuid.UUID, plugin_id: uuid.UUID
    ) -> PluginStatus | None:
        result = await self._session.execute(
            text(
                "SELECT status FROM tenant_plugins "
                "WHERE tenant_id = :tenant_id AND plugin_id = :plugin_id"
            ),
            {"tenant_id": tenant_id, "plugin_id": plugin_id},
        )
        row = result.first()
        return PluginStatus(row[0]) if row else None

    async def upsert_installation(
        self,
        tenant_id: uuid.UUID,
        plugin_id: uuid.UUID,
        status: PluginStatus,
        installed_version: str | None = None,
        error_log: str | None = None,
    ) -> None:
        logger.info(
            "Upserting plugin installation",
            extra={
                "tenant_id": str(tenant_id),
                "plugin_id": str(plugin_id),
                "status": status,
            },
        )
        await self._session.execute(
            text(
                "INSERT INTO tenant_plugins (tenant_id, plugin_id, status, installed_version, install_error_log) "
                "VALUES (:tenant_id, :plugin_id, :status, :version, :error_log) "
                "ON CONFLICT (tenant_id, plugin_id) DO UPDATE SET "
                "status = EXCLUDED.status, "
                "installed_version = COALESCE(EXCLUDED.installed_version, tenant_plugins.installed_version), "
                "install_error_log = EXCLUDED.install_error_log, "
                "last_updated_at = NOW()"
            ),
            {
                "tenant_id": tenant_id,
                "plugin_id": plugin_id,
                "status": status.value,
                "version": installed_version,
                "error_log": error_log,
            },
        )

    async def update_status(
        self,
        tenant_id: uuid.UUID,
        plugin_id: uuid.UUID,
        status: PluginStatus,
        error_log: str | None = None,
    ) -> None:
        logger.info(
            "Updating plugin installation status",
            extra={
                "tenant_id": str(tenant_id),
                "plugin_id": str(plugin_id),
                "status": status,
            },
        )
        await self._session.execute(
            text(
                "UPDATE tenant_plugins "
                "SET status = :status, install_error_log = :error_log, last_updated_at = NOW() "
                "WHERE tenant_id = :tenant_id AND plugin_id = :plugin_id"
            ),
            {
                "tenant_id": tenant_id,
                "plugin_id": plugin_id,
                "status": status.value,
                "error_log": error_log,
            },
        )

    async def get_tenant_plugin_status_by_code(
        self, tenant_id: str | uuid.UUID, plugin_code: str
    ) -> PluginStatus | None:
        result = await self._session.execute(
            text(
                "SELECT tp.status FROM tenant_plugins tp "
                "JOIN plugins p ON p.id = tp.plugin_id "
                "WHERE tp.tenant_id = :tenant AND p.code_name = :plugin"
            ),
            {"tenant": str(tenant_id), "plugin": plugin_code},
        )
        row = result.first()
        return PluginStatus(row[0]) if row else None

    @staticmethod
    def _to_entity(row: dict[str, Any]) -> PluginEntity:
        return PluginEntity(
            id=row["id"],
            code_name=row["code_name"],
            display_name=row["display_name"],
            version=row["version"],
            is_official=row.get("is_official", False),
            status=PluginStatus(row["status"]) if row.get("status") else None,
        )

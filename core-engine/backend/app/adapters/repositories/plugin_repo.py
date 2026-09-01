# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Plugin Repository (SQLAlchemy implementation)
# Đây là phần "Adapter" của Hexagonal Architecture.
# Implement AbstractPluginRepository bằng SQLAlchemy.

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
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

    async def get_by_code_name(self, code_name: str) -> PluginEntity | None:
        logger.debug("Fetching plugin by code_name", extra={"code_name": code_name})
        result = await self._session.execute(
            text(
                "SELECT * FROM plugins WHERE code_name = :code_name AND deleted_at IS NULL"
            ),
            {"code_name": code_name},
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
                "updated_at = NOW()"
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
                "SET status = :status, install_error_log = :error_log, updated_at = NOW() "
                "WHERE tenant_id = :tenant_id AND plugin_id = :plugin_id"
            ),
            {
                "tenant_id": tenant_id,
                "plugin_id": plugin_id,
                "status": status.value,
                "error_log": error_log,
            },
        )

    async def update_config(
        self,
        tenant_id: uuid.UUID,
        plugin_id: uuid.UUID,
        config_override: dict,
    ) -> None:
        await self._session.execute(
            text(
                "UPDATE tenant_plugins "
                "SET config_override = :config, updated_at = NOW() "
                "WHERE tenant_id = :tenant_id AND plugin_id = :plugin_id"
            ),
            {
                "tenant_id": tenant_id,
                "plugin_id": plugin_id,
                "config": json.dumps(config_override),
            },
        )

    async def get_config(
        self,
        tenant_id: uuid.UUID,
        plugin_id: uuid.UUID,
    ) -> dict:
        result = await self._session.execute(
            text(
                "SELECT config_override FROM tenant_plugins "
                "WHERE tenant_id = :tenant_id AND plugin_id = :plugin_id"
            ),
            {"tenant_id": tenant_id, "plugin_id": plugin_id},
        )
        row = result.fetchone()
        if row and row[0]:
            return json.loads(row[0]) if isinstance(row[0], str) else row[0]
        return {}

    async def get_dirty_installations_older_than(self, hours: int) -> list[dict]:
        now = datetime.now(UTC)
        sql = text("""
            SELECT tp.tenant_id, p.code_name as plugin_name, tp.status, tp.updated_at as updated_at
            FROM tenant_plugins tp
            JOIN plugins p ON p.id = tp.plugin_id
            WHERE tp.status = 'FAILED_DIRTY' 
              AND tp.updated_at < :time_ago
        """)
        result = await self._session.execute(
            sql, {"time_ago": now - timedelta(hours=hours)}
        )
        rows = result.mappings().all()
        return [dict(row) for row in rows]

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

    async def get_installed_version(
        self, tenant_id: uuid.UUID, plugin_id: uuid.UUID
    ) -> str | None:
        result = await self._session.execute(
            text(
                "SELECT installed_version FROM tenant_plugins "
                "WHERE tenant_id = :tenant_id AND plugin_id = :plugin_id"
            ),
            {"tenant_id": tenant_id, "plugin_id": plugin_id},
        )
        row = result.first()
        return str(row[0]) if row and row[0] else None

    async def get_failed_dirty_plugins(self) -> list[tuple[uuid.UUID, uuid.UUID, str]]:
        result = await self._session.execute(
            text(
                "SELECT tp.tenant_id, tp.plugin_id, p.code_name "
                "FROM tenant_plugins tp "
                "JOIN plugins p ON p.id = tp.plugin_id "
                "WHERE tp.status = :status"
            ),
            {"status": PluginStatus.FAILED_DIRTY.value},
        )
        return [(row[0], row[1], row[2]) for row in result.all()]

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

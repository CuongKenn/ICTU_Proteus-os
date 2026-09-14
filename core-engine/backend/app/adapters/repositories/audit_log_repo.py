# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractAuditLogRepository


def _to_json_str(value) -> str | None:
    """Chuẩn hoá dict/list/str → chuỗi JSON cho cột JSONB (pattern codebase)."""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, default=str)


class SQLAlchemyAuditLogRepository(AbstractAuditLogRepository):
    """Adapter: Implement Audit Log Repository dùng SQLAlchemy (schema mới)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def insert_log(
        self,
        tenant_id: uuid.UUID | None,
        actor_type: str,
        action: str,
        resource_type: str,
        resource_id: uuid.UUID | None,
        status: str = "success",
        payload: dict | None = None,
        result: dict | None = None,
        user_id: uuid.UUID | None = None,
        ip_address: str | None = None,
        **kwargs,
    ) -> None:
        # Backward-compat: caller cũ truyền command_id / metadata_json / metadata.
        if resource_id is None and kwargs.get("command_id") is not None:
            resource_id = kwargs.get("command_id")
        if payload is None:
            legacy_meta = kwargs.get("metadata_json", kwargs.get("metadata"))
            if isinstance(legacy_meta, str):
                try:
                    payload = json.loads(legacy_meta)
                except (ValueError, TypeError):
                    payload = {"raw": legacy_meta}
            elif isinstance(legacy_meta, dict):
                payload = legacy_meta
        now = datetime.now(UTC)
        sql_audit = text("""
            INSERT INTO audit_logs (
                tenant_id, user_id, actor_type, action, resource_type,
                resource_id, payload, result, status, ip_address, created_at
            ) VALUES (
                :tenant_id, :user_id, :actor_type, :action, :resource_type,
                :resource_id, CAST(:payload AS JSONB), CAST(:result AS JSONB),
                :status, :ip_address, :now
            )
        """)
        await self._session.execute(
            sql_audit,
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "actor_type": actor_type,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "payload": _to_json_str(payload),
                "result": _to_json_str(result),
                "status": status or "success",
                "ip_address": ip_address,
                "now": now,
            },
        )

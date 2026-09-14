# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import json
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractAICommandRepository
from app.core.domain.entities import AICommandStatus

# Cột hợp lệ theo schema mới (migration 7a6db0254da0 + initial 5b760b94e612).
# session_id / dsl_payload / approved_by / second_approver / mattermost_msg_id
# đã bị drop — mọi INSERT phải dùng các cột dưới đây.
_ALLOWED_COLUMNS = frozenset(
    {
        "id",
        "tenant_id",
        "issued_by_user_id",
        "dsl_version",
        "action",
        "effect",
        "parameters",
        "dry_run_result",
        "status",
        "approved_by_user_id",
        "second_approver_id",
        "mattermost_message_id",
        "approval_deadline",
        "execution_result",
        "approved_at",
        "executed_at",
        "created_at",
        "updated_at",
    }
)

# Map tên cột legacy → cột mới (đọc/ghi backward-compat).
_LEGACY_COLUMN_MAP = {
    "approved_by": "approved_by_user_id",
    "second_approver": "second_approver_id",
    "mattermost_msg_id": "mattermost_message_id",
}

# Cột JSONB: repo nhận dict và ghi JSONB (không ghi dsl_payload string).
_JSONB_COLUMNS = frozenset({"parameters", "dry_run_result", "execution_result"})


def _to_json_str(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, default=str)


def _parse_jsonb(value):
    if value is None or isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return value
    return value


class SQLAlchemyAICommandRepository(AbstractAICommandRepository):
    """Adapter: Implement AI Command Repository dùng SQLAlchemy (schema mới)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _resolve_user_id(self, uid) -> object:
        """Map users.id HOẶC keycloak_id → users.id nội bộ (tránh FK violation)."""
        if uid is None:
            return None
        res = await self._session.execute(
            text(
                "SELECT id FROM users WHERE id = :uid OR keycloak_id = :uid LIMIT 1"
            ),
            {"uid": uid},
        )
        real_id = res.scalar()
        return real_id if real_id is not None else uid

    def _sanitize_row(self, data: dict) -> dict:
        """Lọc bỏ cột legacy, map alias cũ → mới, serialize JSONB."""
        out: dict = {}
        for key, value in data.items():
            mapped = _LEGACY_COLUMN_MAP.get(key, key)
            # Bỏ session_id / dsl_payload và mọi cột không còn trong schema.
            if mapped not in _ALLOWED_COLUMNS:
                continue
            if mapped in _JSONB_COLUMNS:
                value = _to_json_str(value)
            out[mapped] = value
        if not out.get("dsl_version"):
            out["dsl_version"] = "1.0"
        return out

    def _normalize_row(self, row: dict) -> dict:
        """Backward-compat đọc: parse JSONB string; parameters null thì
        parse từ dsl_payload cũ (DB chưa migrate); map alias cũ → mới."""
        data = dict(row)
        for legacy, new in _LEGACY_COLUMN_MAP.items():
            if new not in data or data.get(new) is None:
                if legacy in data and data.get(legacy) is not None:
                    data[new] = data.pop(legacy)
                continue
            data.pop(legacy, None)
        for col in _JSONB_COLUMNS:
            if col in data:
                data[col] = _parse_jsonb(data[col])
        if data.get("parameters") is None and data.get("dsl_payload") is not None:
            try:
                raw = data["dsl_payload"]
                payload = json.loads(raw) if isinstance(raw, str) else raw
                data["parameters"] = (payload or {}).get("parameters")
            except (ValueError, TypeError, AttributeError):
                data["parameters"] = None
        if data.get("dry_run_result") is None and isinstance(
            data.get("dry_run_result"), str
        ):
            data["dry_run_result"] = _parse_jsonb(data.get("dry_run_result"))
        data.pop("dsl_payload", None)
        data.pop("session_id", None)
        return data

    async def get_pending_commands_expiring_soon(self, minutes: int) -> list[dict]:
        now = datetime.now(UTC)
        soon = now + timedelta(minutes=minutes)

        sql = text("""
            SELECT c.id, c.action, c.approval_deadline, c.issued_by_user_id
            FROM ai_commands c
            WHERE c.status = 'PENDING_APPROVAL'
              AND c.approval_deadline > :now
              AND c.approval_deadline < :soon
        """)
        result = await self._session.execute(sql, {"now": now, "soon": soon})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def get_expired_pending_commands(self) -> list[dict]:
        now = datetime.now(UTC)
        sql_find = text("""
            SELECT id, action, tenant_id, issued_by_user_id
            FROM ai_commands
            WHERE status = 'PENDING_APPROVAL'
              AND approval_deadline < :now
        """)
        result = await self._session.execute(sql_find, {"now": now})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def count_failed_since(self, minutes: int) -> int:
        since = datetime.now(UTC) - timedelta(minutes=minutes)
        result = await self._session.execute(
            text(
                "SELECT COUNT(*) FROM ai_commands "
                "WHERE status = 'FAILED' AND created_at > :since"
            ),
            {"since": since},
        )
        return int(result.scalar() or 0)

    async def get_pending_older_than(self, minutes: int, limit: int = 5) -> list[dict]:
        since = datetime.now(UTC) - timedelta(minutes=minutes)
        result = await self._session.execute(
            text(
                "SELECT id, action, issued_by_user_id, approval_deadline "
                "FROM ai_commands WHERE status = 'PENDING_APPROVAL' "
                "AND created_at < :since ORDER BY created_at LIMIT :lim"
            ),
            {"since": since, "lim": limit},
        )
        return [dict(row) for row in result.mappings().all()]

    async def update_status(self, cmd_id: uuid.UUID, status: AICommandStatus) -> None:
        sql_update = text("""
            UPDATE ai_commands
            SET status = :status, updated_at = NOW()
            WHERE id = :cmd_id
        """)
        await self._session.execute(
            sql_update, {"status": status.value, "cmd_id": cmd_id}
        )

    async def create_command(self, command_data: dict) -> uuid.UUID:
        data = self._sanitize_row(dict(command_data))
        now = datetime.now(UTC)
        if "created_at" not in data:
            data["created_at"] = now

        # Map Keycloak ID to Internal ID if needed to prevent FK violation
        if "issued_by_user_id" in data:
            data["issued_by_user_id"] = await self._resolve_user_id(
                data["issued_by_user_id"]
            )
        for approver_col in ("approved_by_user_id", "second_approver_id"):
            if data.get(approver_col) is not None:
                data[approver_col] = await self._resolve_user_id(
                    data[approver_col]
                )

        columns = ", ".join(data.keys())
        placeholders = ", ".join(f":{k}" for k in data.keys())
        # Idempotent theo command_id: retry cùng id không tạo 2 dòng.
        sql = text(
            f"INSERT INTO ai_commands ({columns}) VALUES ({placeholders}) "
            "ON CONFLICT (id) DO NOTHING RETURNING id"
        )
        result = await self._session.execute(sql, data)
        returned = result.scalar()
        if returned is not None:
            return returned
        # Conflict → dòng đã tồn tại, trả về id gốc (caller retry an toàn).
        return data.get("id")

    async def get_command_by_id(
        self, cmd_id: uuid.UUID, for_update: bool = False
    ) -> dict | None:
        # Gọi trong transaction của caller khi for_update=True
        # (SELECT FOR UPDATE + UPDATE conditional phải cùng transaction
        # để chống approval race — xem process_approval).
        sql_str = "SELECT * FROM ai_commands WHERE id = :cmd_id"
        if for_update:
            sql_str += " FOR UPDATE"
        sql = text(sql_str)
        result = await self._session.execute(sql, {"cmd_id": cmd_id})
        row = result.mappings().first()
        return self._normalize_row(dict(row)) if row else None

    async def update_command_approval(
        self,
        cmd_id: uuid.UUID,
        status: str | None = None,
        approved_by_user_id: str | None = None,
        second_approver_id: str | None = None,
        approved_by: str | None = None,
        second_approver: str | None = None,
        mattermost_message_id: str | None = None,
    ) -> int:
        # Alias deprecated → cột mới.
        if approved_by_user_id is None and approved_by is not None:
            approved_by_user_id = approved_by
        if second_approver_id is None and second_approver is not None:
            second_approver_id = second_approver

        updates = ["updated_at = NOW()"]
        params: dict = {"cmd_id": str(cmd_id)}

        if status is not None:
            updates.append("status = :status")
            params["status"] = status
            if status == "APPROVED":
                updates.append("approved_at = COALESCE(approved_at, NOW())")
        if approved_by_user_id is not None:
            updates.append("approved_by_user_id = :approved_by_user_id")
            params["approved_by_user_id"] = approved_by_user_id
        if second_approver_id is not None:
            updates.append("second_approver_id = :second_approver_id")
            params["second_approver_id"] = second_approver_id
        if mattermost_message_id is not None:
            updates.append("mattermost_message_id = :mattermost_message_id")
            params["mattermost_message_id"] = mattermost_message_id

        if len(updates) == 1:
            return 0

        set_clause = ", ".join(updates)
        # Chống double-execution / approval race: chỉ chuyển khi còn PENDING
        # và chưa hết deadline. Caller check rowcount == 0 → "invalid".
        sql = (
            f"UPDATE ai_commands SET {set_clause} WHERE id = :cmd_id "
            "AND status = 'PENDING_APPROVAL' "
            "AND (approval_deadline IS NULL OR approval_deadline > NOW())"
        )

        result = await self._session.execute(text(sql), params)
        return int(result.rowcount or 0)

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()

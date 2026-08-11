import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractAICommandRepository
from app.core.domain.entities import AICommandStatus


class SQLAlchemyAICommandRepository(AbstractAICommandRepository):
    """Adapter: Implement AI Command Repository dùng SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_pending_commands_expiring_soon(self, minutes: int) -> list[dict]:
        now = datetime.now(timezone.utc)
        soon = now + timedelta(minutes=minutes)

        sql = text("""
            SELECT c.id, c.action, c.expires_at, c.requested_by
            FROM ai_commands c
            WHERE c.status = 'PENDING_APPROVAL'
              AND c.expires_at > :now
              AND c.expires_at < :soon
        """)
        result = await self._session.execute(sql, {"now": now, "soon": soon})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def get_expired_pending_commands(self) -> list[dict]:
        now = datetime.now(timezone.utc)
        sql_find = text("""
            SELECT id, action, tenant_id, requested_by
            FROM ai_commands
            WHERE status = 'PENDING_APPROVAL'
              AND approval_deadline < :now
        """)
        result = await self._session.execute(sql_find, {"now": now})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def update_status(self, cmd_id: uuid.UUID, status: AICommandStatus) -> None:
        now = datetime.now(timezone.utc)
        sql_update = text("""
            UPDATE ai_commands
            SET status = :status, updated_at = :now
            WHERE id = :cmd_id
        """)
        await self._session.execute(
            sql_update, {"status": status.value, "now": now, "cmd_id": cmd_id}
        )

    async def create_command(self, command_data: dict) -> uuid.UUID:
        now = datetime.now(timezone.utc)
        if "created_at" not in command_data:
            command_data["created_at"] = now

        columns = ", ".join(command_data.keys())
        placeholders = ", ".join(f":{k}" for k in command_data.keys())
        sql = text(
            f"INSERT INTO ai_commands ({columns}) VALUES ({placeholders}) RETURNING id"
        )
        result = await self._session.execute(sql, command_data)
        return result.scalar()

    async def get_command_by_id(self, cmd_id: uuid.UUID) -> dict | None:
        sql = text("SELECT * FROM ai_commands WHERE id = :cmd_id")
        result = await self._session.execute(sql, {"cmd_id": cmd_id})
        row = result.mappings().first()
        return dict(row) if row else None

    async def update_command_approval(
        self,
        cmd_id: uuid.UUID,
        status: str | None = None,
        approved_by: str | None = None,
        second_approver: str | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        updates = ["updated_at = :now"]
        params = {"now": now, "cmd_id": str(cmd_id)}

        if status is not None:
            updates.append("status = :status")
            params["status"] = status
        if approved_by is not None:
            updates.append("approved_by = :approved_by")
            params["approved_by"] = approved_by
        if second_approver is not None:
            updates.append("second_approver = :second_approver")
            params["second_approver"] = second_approver

        sql_update = text(
            f"UPDATE ai_commands SET {', '.join(updates)} WHERE id = :cmd_id"
        )
        await self._session.execute(sql_update, params)

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()

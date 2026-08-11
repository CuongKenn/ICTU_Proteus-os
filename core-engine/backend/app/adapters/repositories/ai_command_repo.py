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

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()

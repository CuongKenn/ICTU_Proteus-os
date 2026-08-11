from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractAICommandRepository


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

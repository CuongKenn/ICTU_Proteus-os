import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractAuditLogRepository


class SQLAlchemyAuditLogRepository(AbstractAuditLogRepository):
    """Adapter: Implement Audit Log Repository dùng SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def insert_log(
        self,
        tenant_id: uuid.UUID,
        actor_type: str,
        action: str,
        resource_type: str,
        resource_id: uuid.UUID,
        command_id: uuid.UUID,
        metadata_json: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        sql_audit = text("""
            INSERT INTO audit_logs (
                tenant_id, actor_type, action, resource_type, resource_id, command_id, metadata, created_at
            ) VALUES (
                :tenant_id, :actor_type, :action, :resource_type, :resource_id, :command_id, :metadata, :now
            )
        """)
        await self._session.execute(
            sql_audit,
            {
                "tenant_id": tenant_id,
                "actor_type": actor_type,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "command_id": command_id,
                "metadata": metadata_json,
                "now": now,
            },
        )

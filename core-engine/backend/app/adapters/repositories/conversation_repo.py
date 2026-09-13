# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Adapter — Conversation Repository (ai_sessions + ai_messages).
# Mọi query đều filter (tenant_id, user_id): user chỉ thấy memory của mình.

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import AIMessageModel, AISessionModel


class ConversationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _internal_user_id(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID
    ) -> uuid.UUID:
        """Map users.id HOẶC keycloak_id → users.id nội bộ (cùng tenant).

        JWT sub là keycloak_id trong khi FK trỏ users.id — không map sẽ
        FK violation (giống ai_command_repo.create_command).
        """
        from sqlalchemy import text

        res = await self.session.execute(
            text(
                "SELECT id FROM users WHERE tenant_id = :tid "
                "AND (id = :uid OR keycloak_id = :uid) LIMIT 1"
            ),
            {"tid": tenant_id, "uid": user_id},
        )
        real_id = res.scalar()
        if real_id is None:
            raise ValueError(f"User {user_id} không thuộc tenant {tenant_id}")
        return real_id

    async def ensure_session(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        session_id: uuid.UUID | None = None,
    ) -> uuid.UUID:
        internal_id = await self._internal_user_id(tenant_id, user_id)
        if session_id is not None:
            stmt = select(AISessionModel).where(
                and_(
                    AISessionModel.id == session_id,
                    AISessionModel.tenant_id == tenant_id,
                    AISessionModel.user_id == internal_id,
                    AISessionModel.deleted_at.is_(None),
                )
            )
            if (await self.session.execute(stmt)).scalar_one_or_none() is not None:
                return session_id
            # session_id lạ (của user khác/tenant khác) → tạo mới, không reuse.
        row = AISessionModel(tenant_id=tenant_id, user_id=internal_id)
        self.session.add(row)
        await self.session.flush()
        return row.id

    async def list_sessions(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, limit: int = 20
    ) -> list[dict]:
        internal_id = await self._internal_user_id(tenant_id, user_id)
        stmt = (
            select(AISessionModel)
            .where(
                and_(
                    AISessionModel.tenant_id == tenant_id,
                    AISessionModel.user_id == internal_id,
                    AISessionModel.deleted_at.is_(None),
                )
            )
            .order_by(desc(AISessionModel.updated_at))
            .limit(limit)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return [
            {
                "id": str(r.id),
                "title": r.title,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]

    async def append_message(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        role: str,
        content: str,
        command_id: uuid.UUID | None = None,
        citations: list[dict] | None = None,
    ) -> uuid.UUID:
        internal_id = await self._internal_user_id(tenant_id, user_id)
        row = AIMessageModel(
            session_id=session_id,
            tenant_id=tenant_id,
            user_id=internal_id,
            role=role,
            content=content[:20000],
            command_id=command_id,
            citations=citations,
        )
        self.session.add(row)
        await self.session.flush()
        # Chạm updated_at để sort sessions mới nhất trước.
        sess = await self.session.get(AISessionModel, session_id)
        if sess is not None:
            sess.updated_at = datetime.now(UTC)
            if not sess.title and role == "user":
                sess.title = content[:80]
        return row.id

    async def list_messages(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        limit: int = 100,
    ) -> list[dict]:
        internal_id = await self._internal_user_id(tenant_id, user_id)
        sess_stmt = select(AISessionModel.id).where(
            and_(
                AISessionModel.id == session_id,
                AISessionModel.tenant_id == tenant_id,
                AISessionModel.user_id == internal_id,
                AISessionModel.deleted_at.is_(None),
            )
        )
        if (await self.session.execute(sess_stmt)).scalar_one_or_none() is None:
            return []
        stmt = (
            select(AIMessageModel)
            .where(
                and_(
                    AIMessageModel.session_id == session_id,
                    AIMessageModel.tenant_id == tenant_id,
                    AIMessageModel.deleted_at.is_(None),
                )
            )
            .order_by(AIMessageModel.created_at)
            .limit(limit)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return [
            {
                "id": str(r.id),
                "role": r.role,
                "content": r.content,
                "command_id": str(r.command_id) if r.command_id else None,
                "citations": r.citations,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    async def commit(self) -> None:
        await self.session.commit()

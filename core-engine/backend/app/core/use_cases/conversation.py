# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Use Case — AI Conversation Memory (server-side).
# Mỗi user có sessions riêng trong tenant của mình (cô lập ở repo-layer).

from __future__ import annotations

import uuid

from app.adapters.repositories.base import AbstractConversationRepository


class ConversationUseCase:
    def __init__(self, conversation_repo: AbstractConversationRepository):
        self.conversation_repo = conversation_repo

    async def ensure_session(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        session_id: uuid.UUID | None = None,
    ) -> uuid.UUID:
        return await self.conversation_repo.ensure_session(
            tenant_id, user_id, session_id
        )

    async def save_turn(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        role: str,
        content: str,
        command_id: uuid.UUID | None = None,
        citations: list[dict] | None = None,
    ) -> uuid.UUID:
        if role not in ("user", "assistant", "system"):
            raise ValueError(f"role không hợp lệ: {role}")
        return await self.conversation_repo.append_message(
            tenant_id, user_id, session_id, role, content, command_id, citations
        )

    async def history(
        self,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        limit: int = 100,
    ) -> list[dict]:
        return await self.conversation_repo.list_messages(
            tenant_id, user_id, session_id, limit
        )

    async def sessions(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID, limit: int = 20
    ) -> list[dict]:
        return await self.conversation_repo.list_sessions(tenant_id, user_id, limit)

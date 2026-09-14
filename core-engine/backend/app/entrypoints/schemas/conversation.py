# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Schemas — AI Conversation Memory.

import uuid

from pydantic import BaseModel, Field


class SessionEnsureRequest(BaseModel):
    session_id: uuid.UUID | None = Field(
        default=None, description="Session client đang giữ (nếu có)."
    )


class SessionResponse(BaseModel):
    session_id: uuid.UUID


class MessageAppendRequest(BaseModel):
    role: str = Field(description="user | assistant | system")
    content: str = Field(min_length=1, max_length=20000)
    command_id: uuid.UUID | None = None
    citations: list[dict] | None = None


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    command_id: uuid.UUID | None = None
    citations: list[dict] | None = None
    created_at: str | None = None


class SessionInfoResponse(BaseModel):
    id: uuid.UUID
    title: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

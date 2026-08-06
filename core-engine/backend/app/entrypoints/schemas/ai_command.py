# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — Pydantic Schemas for AI Command API
# Tham chiếu: docs/dsl-spec.md §2

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.domain.entities import AICommandStatus


class AICommandRequest(BaseModel):
    """Input schema cho POST /ai/command. Phản ánh cấu trúc DX-DSL."""

    dsl_version: str = Field("1.0", description="Phiên bản DX-DSL spec")
    command_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    session_id: uuid.UUID = Field(..., description="ID phiên chat")
    action: str = Field(..., description="Action theo chuẩn {plugin}.{resource}.{verb}")
    effect: Literal["read", "write", "critical"] = Field(
        ..., description="Mức độ tác động"
    )
    parameters: dict[str, Any] = Field(default_factory=dict)
    approval_message: str | None = Field(
        None, description="Nội dung tin nhắn Mattermost gửi xin phê duyệt"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "dsl_version": "1.0",
                "session_id": "7d793037-a076-4c06-8fde-1b9b7b16e01b",
                "action": "hr.leave_requests.batch_approve",
                "effect": "write",
                "parameters": {"filter": {"date": "2026-08-06", "status": "pending"}},
                "approval_message": "⚠️ Chuẩn bị duyệt 12 đơn nghỉ phép. Xác nhận?",
            }
        }
    }


class AICommandResponse(BaseModel):
    """Output schema cho POST /ai/command."""

    command_id: uuid.UUID  # Nhất quán với Request — không dùng str
    status: AICommandStatus  # Dùng Enum từ domain — Swagger tự gen đúng
    message: str
    result: dict[str, Any] | None = None

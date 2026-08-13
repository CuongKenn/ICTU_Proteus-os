# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — Pydantic Schemas for Plugin API (Input/Output)
# Dùng để FastAPI tự sinh Swagger documentation

import uuid

from pydantic import BaseModel, Field

from app.core.domain.entities import PluginStatus


class PluginResponse(BaseModel):
    id: uuid.UUID
    code_name: str
    display_name: str
    version: str
    is_official: bool
    status: PluginStatus | None = (
        None  # Type-safe: chỉ nhận giá trị PluginStatus hợp lệ
    )

    model_config = {"from_attributes": True}


class PluginListResponse(BaseModel):
    items: list[PluginResponse]
    total: int


class PluginUninstallRequest(BaseModel):
    confirm_name: str = Field(
        ...,
        description="Xác nhận tên Plugin (code_name) để tránh xóa nhầm",
    )


class PluginSynthesizeRequest(BaseModel):
    prompt: str = Field(
        ...,
        description="Yêu cầu bằng ngôn ngữ tự nhiên để AI tự động sinh Plugin",
    )


class PluginCredentialPayload(BaseModel):
    credential_type: str = Field(
        ...,
        description="Loại credential trên n8n (VD: smtp, githubApi, postgres)",
    )
    credential_name: str = Field(
        ...,
        description="Tên định danh cho credential",
    )
    data: dict[str, str] = Field(
        ...,
        description="Dữ liệu nhạy cảm dạng key-value",
    )

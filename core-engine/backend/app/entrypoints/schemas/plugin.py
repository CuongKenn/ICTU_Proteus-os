# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — Pydantic Schemas for Plugin API (Input/Output)
# Dùng để FastAPI tự sinh Swagger documentation

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.core.domain.entities import PluginStatus


# ─────────────────────────────────────────────────────────────
# CREDENTIAL SCHEMAS
# ─────────────────────────────────────────────────────────────


class CredentialFieldSchemaOut(BaseModel):
    """Schema của một trường credential — trả về trong PluginResponse."""

    key: str
    label: str
    type: Literal["string", "password", "number", "boolean", "select"] = "string"
    required: bool = True
    placeholder: str | None = None
    description: str | None = None
    default: Any | None = None
    options: list[str] | None = None
    credential_type_name: str | None = None


class CredentialInputSchema(BaseModel):
    """Input credential từ người dùng khi cài plugin."""

    key: str = Field(..., description="Khóa field (khớp với credentials_schema[].key)")
    value: str = Field(..., description="Giá trị credential (không bao giờ lưu vào DB Proteus)")
    credential_type_name: str | None = Field(
        None,
        description="n8n credential type override (nếu để trống sẽ dùng từ schema)",
    )


# ─────────────────────────────────────────────────────────────
# INSTALL SCHEMAS
# ─────────────────────────────────────────────────────────────


class InstallPluginRequest(BaseModel):
    """Body cho POST /{plugin_id}/install."""

    credentials: list[CredentialInputSchema] = Field(
        default_factory=list,
        description=(
            "Danh sách credentials cần thiết để plugin hoạt động. "
            "Chỉ cần cung cấp nếu plugin có credentials_schema bắt buộc. "
            "Credentials sẽ được gửi thẳng sang n8n — "
            "không bao giờ được lưu vào database của Proteus OS."
        ),
    )


# ─────────────────────────────────────────────────────────────
# INSTALL STATUS SCHEMAS
# ─────────────────────────────────────────────────────────────


class InstallStepLog(BaseModel):
    """Một bước trong quá trình cài đặt plugin."""

    step: str = Field(description="Tên bước: database | n8n | metabase | appsmith | keycloak | events | credentials | complete")
    status: Literal["PENDING", "RUNNING", "DONE", "FAILED"] = "PENDING"
    at: str | None = Field(None, description="ISO8601 timestamp")
    message: str | None = None


class InstallStatusResponse(BaseModel):
    """Response cho GET /install/{task_id}/status."""

    overall_status: str = Field(description="INSTALLING | ACTIVE | FAILED_DIRTY")
    steps: list[InstallStepLog] = Field(default_factory=list)
    plugin_id: str | None = None


# ─────────────────────────────────────────────────────────────
# PLUGIN RESPONSE SCHEMAS
# ─────────────────────────────────────────────────────────────


class PluginResponse(BaseModel):
    """Response cho Plugin Marketplace list item."""

    id: uuid.UUID
    code_name: str
    display_name: str
    description: str | None = None
    version: str
    author: str | None = None
    icon_url: str | None = None
    homepage_url: str | None = None
    category: str = "Utilities"
    tags: list[str] = Field(default_factory=list)
    is_official: bool
    download_count: int = 0
    published_at: datetime | None = None
    status: PluginStatus | None = None
    tables_count: int = 0
    workflows_count: int = 0
    roles: list[str] = Field(default_factory=list)
    credentials_schema: list[CredentialFieldSchemaOut] = Field(
        default_factory=list,
        description="Form schema để frontend render credential inputs khi cài đặt",
    )

    model_config = {"from_attributes": True}


class PluginDetailResponse(PluginResponse):
    """Response cho GET /plugins/{id} — đầy đủ thông tin hơn."""

    screenshots: list[str] = Field(default_factory=list)
    long_description: str | None = None
    license: str | None = None


class PluginListResponse(BaseModel):
    items: list[PluginResponse]
    total: int


# ─────────────────────────────────────────────────────────────
# OTHER REQUEST SCHEMAS
# ─────────────────────────────────────────────────────────────


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
    """Dùng cho endpoint standalone /credentials (configure sau khi install)."""

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

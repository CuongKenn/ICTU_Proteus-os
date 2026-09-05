# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Domain Entities
# ⚠️  TUYỆT ĐỐI KHÔNG import FastAPI, SQLAlchemy,
# hay bất kỳ thư viện bên ngoài nào vào đây.
# Layer này chỉ chứa logic nghiệp vụ thuần túy (Pure Python).

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────────────────────


class PluginStatus(StrEnum):
    INSTALLING = "INSTALLING"
    ACTIVE = "ACTIVE"
    FAILED_DIRTY = "FAILED_DIRTY"
    DISABLED = "DISABLED"
    UNINSTALLING = "UNINSTALLING"
    DELETED = "DELETED"
    PENDING_CREDENTIALS = "PENDING_CREDENTIALS"
    """Plugin đã cài xong nhưng chưa được cấu hình credentials bắt buộc."""


# ─────────────────────────────────────────────────────────────
# CREDENTIAL TYPES
# ─────────────────────────────────────────────────────────────


class CredentialFieldType(StrEnum):
    STRING = "string"
    PASSWORD = "password"
    NUMBER = "number"
    BOOLEAN = "boolean"
    SELECT = "select"


class CredentialFieldSchema(BaseModel):
    """Schema mô tả một trường credential (mirrors ManifestCredentialField)."""

    key: str
    label: str
    type: CredentialFieldType = CredentialFieldType.STRING
    required: bool = True
    placeholder: str | None = None
    description: str | None = None
    default: str | int | bool | None = None
    options: list[str] | None = None
    credential_type_name: str | None = None


class CredentialInput(BaseModel):
    """Một credential value do người dùng nhập khi cài plugin."""

    key: str
    """Khớp với CredentialFieldSchema.key."""
    value: str
    """Giá trị nhập vào (luôn là string, backend sẽ cast theo type)."""
    credential_type_name: str | None = None
    """n8n credential type — override từ schema nếu cần."""


class AICommandStatus(StrEnum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


class EffectLevel(StrEnum):
    READ = "read"
    WRITE = "write"
    CRITICAL = "critical"


class ActorType(StrEnum):
    HUMAN = "HUMAN"
    AI_AGENT = "AI_AGENT"
    SYSTEM = "SYSTEM"


# ─────────────────────────────────────────────────────────────
# DOMAIN ENTITIES (Pure Pydantic — no DB dependency)
# ─────────────────────────────────────────────────────────────


class TenantContext(BaseModel):
    """
    JWT Context của request hiện tại.
    Được inject vào mọi Use Case từ tầng Entrypoint.
    """

    tenant_id: uuid.UUID
    user_id: uuid.UUID
    roles: list[str] = Field(default_factory=list)
    email: str = ""
    full_name: str = ""


class PluginEntity(BaseModel):
    # ─── Identity ──────────────────────────────────────────────
    id: uuid.UUID
    code_name: str
    display_name: str
    version: str

    # ─── Metadata (previously missing) ───────────────────────
    description: str | None = None
    author: str | None = None
    license: str | None = None
    icon_url: str | None = None
    homepage_url: str | None = None
    category: str = "Utilities"
    tags: list[str] = Field(default_factory=list)
    screenshots: list[str] = Field(default_factory=list)
    long_description: str | None = None
    is_official: bool = False
    download_count: int = 0
    published_at: datetime | None = None

    # ─── Install info ─────────────────────────────────────────
    status: PluginStatus | None = None  # None nếu chưa cài cho Tenant này
    tables_count: int = 0
    workflows_count: int = 0
    roles: list[str] = Field(default_factory=list)

    # ─── Credentials schema (từ manifest) ────────────────────
    credentials_schema: list[CredentialFieldSchema] = Field(default_factory=list)
    """Schema form credentials để frontend render động."""

    def requires_credentials(self) -> bool:
        """Kiểm tra xem plugin có yêu cầu credentials bắt buộc không."""
        return any(f.required for f in self.credentials_schema)


class TenantEntity(BaseModel):
    """
    Domain Entity cho Tenant (Tổ chức).
    Lưu metadata của Organization trong hệ thống.
    """

    id: uuid.UUID
    name: str
    slug: str
    keycloak_realm: str
    plan: str = "starter"
    is_active: bool = True


class TenantIntegrationEntity(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    provider: str
    config: dict[str, Any]
    is_active: bool = True


class UserEntity(BaseModel):
    """
    Domain Entity cho User.
    """

    id: uuid.UUID
    tenant_id: uuid.UUID
    keycloak_id: uuid.UUID
    email: str
    full_name: str
    roles: list[str] = Field(default_factory=list)
    is_active: bool = True


class AICommandEntity(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    issued_by_user_id: uuid.UUID
    action: str
    effect: EffectLevel
    status: AICommandStatus
    dsl_payload: dict[str, Any]
    dry_run_result: dict[str, Any] | None = None
    approval_deadline: datetime | None = None
    created_at: datetime


class InstallRequest(BaseModel):
    """Input cho Use Case cài đặt Plugin."""

    plugin_id: uuid.UUID
    tenant_context: TenantContext
    credentials: list[CredentialInput] = Field(default_factory=list)
    """Credentials người dùng nhập (theo credentials_schema của plugin)."""


class AICommandInput(BaseModel):
    """
    Input cho Use Case xử lý DX-DSL Command.
    (Khác với schema AICommandRequest ở entrypoints)
    """

    dsl_payload: dict[str, Any]
    tenant_context: TenantContext

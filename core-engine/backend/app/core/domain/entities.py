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
from typing import Any

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
    id: uuid.UUID
    code_name: str
    display_name: str
    version: str
    is_official: bool = False
    status: PluginStatus | None = None  # None nếu chưa cài cho Tenant này
    tables_count: int = 0
    workflows_count: int = 0
    roles: list[str] = Field(default_factory=list)


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


class AICommandInput(BaseModel):
    """
    Input cho Use Case xử lý DX-DSL Command.
    (Khác với schema AICommandRequest ở entrypoints)
    """

    dsl_payload: dict[str, Any]
    tenant_context: TenantContext

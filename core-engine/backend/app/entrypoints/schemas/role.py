# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RoleBase(BaseModel):
    name: str = Field(..., max_length=255)
    display_name: str = Field(..., max_length=255)
    description: str | None = None
    plugin_code_name: str | None = None
    # DB tồn tại 2 format: dict {"mod": [...]} và list ["*"] (legacy).
    # Giữ union để GET /v1/roles không 500 khi gặp format cũ.
    permissions: dict[str, Any] | list[Any] | None = None


class RoleCreate(RoleBase):
    pass


class RoleUpdate(RoleBase):
    name: str | None = Field(None, max_length=255)
    display_name: str | None = Field(None, max_length=255)


class RoleResponse(RoleBase):
    id: uuid.UUID
    tenant_id: uuid.UUID | None = None
    is_system_role: bool

    model_config = ConfigDict(from_attributes=True)


class RoleAssign(BaseModel):
    user_id: uuid.UUID


class RoleTemplateInfo(BaseModel):
    """Tóm tắt 1 template role."""

    key: str
    name: str
    description: str
    roles_count: int


class ApplyTemplateRequest(BaseModel):
    """Body cho POST /roles/apply-template."""

    template_key: str = Field(
        ..., description="Khóa template: sme | school | government"
    )


class ApplyTemplateResponse(BaseModel):
    """Kết quả áp template (idempotent)."""

    template_key: str
    created: list[str] = Field(default_factory=list)
    skipped: list[str] = Field(default_factory=list)

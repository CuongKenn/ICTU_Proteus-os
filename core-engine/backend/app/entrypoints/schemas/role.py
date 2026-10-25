# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


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

    @model_validator(mode="before")
    @classmethod
    def _coalesce_display_name(cls, data: Any) -> Any:
        """Fallback display_name ← name khi DB legacy thiếu (tránh 500).

        Không mutate ORM object (tránh dirty session flush trong GET).
        """
        if isinstance(data, dict):
            if not data.get("display_name") and data.get("name"):
                return {**data, "display_name": data["name"]}
            return data
        if not getattr(data, "display_name", None):
            name = getattr(data, "name", "") or ""
            return {
                "id": getattr(data, "id", None),
                "tenant_id": getattr(data, "tenant_id", None),
                "name": name,
                "display_name": name,
                "description": getattr(data, "description", None),
                "plugin_code_name": getattr(data, "plugin_code_name", None),
                "permissions": getattr(data, "permissions", None),
                "is_system_role": getattr(data, "is_system_role", False),
            }
        return data


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

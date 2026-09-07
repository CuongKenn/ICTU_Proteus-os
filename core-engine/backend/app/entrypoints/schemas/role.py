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
    permissions: dict[str, Any] | None = None


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

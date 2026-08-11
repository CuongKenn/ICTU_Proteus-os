# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from typing import Optional

from pydantic import BaseModel, Field


class TenantCreateRequest(BaseModel):
    name: str = Field(..., description="Tên của tổ chức (Tenant)")
    slug: str = Field(
        ...,
        description="Slug duy nhất cho tổ chức (dùng cho sub-domain hoặc URL)",
        pattern=r"^[a-z0-9-]+$",
    )
    plan: str = Field(
        default="starter", description="Gói dịch vụ (starter, pro, enterprise)"
    )


class TenantUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, description="Tên của tổ chức")
    plan: Optional[str] = Field(None, description="Gói dịch vụ")
    is_active: Optional[bool] = Field(None, description="Trạng thái hoạt động")


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    keycloak_realm: str
    plan: str
    is_active: bool

    model_config = {"from_attributes": True}

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from pydantic import BaseModel, EmailStr, Field

class SignupRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    admin_full_name: str = Field(..., min_length=2, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=8)

class SignupResponse(BaseModel):
    tenant_id: str
    slug: str
    user_id: str
    message: str

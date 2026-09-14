# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from pydantic import BaseModel, Field, field_validator


class SignupRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    admin_full_name: str = Field(..., min_length=2, max_length=255)
    admin_email: str = Field(
        ..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    )
    admin_password: str = Field(..., min_length=8)

    @field_validator("admin_password")
    @classmethod
    def check_password_complexity(cls, v: str) -> str:
        """C10: chặn mật khẩu yếu ngay ở schema (hoa + thường + số)."""
        import re as _re

        if not _re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu phải có ít nhất 1 chữ hoa.")
        if not _re.search(r"[a-z]", v):
            raise ValueError("Mật khẩu phải có ít nhất 1 chữ thường.")
        if not _re.search(r"[0-9]", v):
            raise ValueError("Mật khẩu phải có ít nhất 1 chữ số.")
        return v


class SignupResponse(BaseModel):
    tenant_id: str
    slug: str
    user_id: str
    message: str

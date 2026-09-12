# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Tests cho wildcard permissions + schema linh hoạt (fix khóa nút install)."""

import uuid
from unittest.mock import AsyncMock

import pytest

from app.core.domain.entities import TenantContext
from app.core.domain.exceptions import InsufficientPermissionsError
from app.core.domain.permissions import (
    has_admin_role,
    has_wildcard_permission,
)
from app.entrypoints.dependencies import require_permission
from app.entrypoints.schemas.role import RoleResponse


def _ctx(roles):
    return TenantContext(
        tenant_id=uuid.uuid4(), user_id=uuid.uuid4(), roles=roles
    )


def test_has_admin_role():
    assert has_admin_role(["tenant_admin"])
    assert has_admin_role(["user", "superadmin"])
    assert not has_admin_role(["user"])


def test_has_wildcard_permission():
    assert has_wildcard_permission(["*"])
    assert has_wildcard_permission(["*:*"])
    assert has_wildcard_permission(["asset:items:read", "*"])
    assert not has_wildcard_permission(["asset:items:read"])
    assert not has_wildcard_permission([])


def test_role_response_accepts_list_format():
    r = RoleResponse(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        is_system_role=True,
        name="tenant_admin",
        display_name="Tenant Admin",
        permissions=["*"],
    )
    assert r.permissions == ["*"]


def test_role_response_accepts_dict_format():
    r = RoleResponse(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        is_system_role=True,
        name="hr_manager",
        display_name="HR Manager",
        permissions={"hr": ["employees:read"]},
    )
    assert r.permissions == {"hr": ["employees:read"]}


@pytest.mark.asyncio
async def test_require_permission_wildcard_list():
    role_repo = AsyncMock()
    role_repo.get_user_permissions.return_value = ["*"]
    check = require_permission("plugins.install")
    ctx = await check(context=_ctx(["user"]), role_repo=role_repo)
    assert ctx is not None


@pytest.mark.asyncio
async def test_require_permission_wildcard_dict_form():
    role_repo = AsyncMock()
    role_repo.get_user_permissions.return_value = ["*:*"]
    check = require_permission("plugins.install")
    ctx = await check(context=_ctx(["user"]), role_repo=role_repo)
    assert ctx is not None


@pytest.mark.asyncio
async def test_require_permission_denied():
    role_repo = AsyncMock()
    role_repo.get_user_permissions.return_value = ["hr:employees:read"]
    check = require_permission("plugins.install")
    with pytest.raises(InsufficientPermissionsError):
        await check(context=_ctx(["user"]), role_repo=role_repo)

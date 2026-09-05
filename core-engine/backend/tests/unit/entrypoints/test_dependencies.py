# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock

import pytest

from app.core.domain.entities import TenantContext
from app.core.domain.exceptions import InsufficientPermissionsError
from app.entrypoints.dependencies import require_permission


@pytest.fixture
def mock_role_repo():
    return AsyncMock()


@pytest.fixture
def normal_context():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["user"],
        email="user@test.com",
        full_name="User",
    )


@pytest.fixture
def superadmin_context():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["superadmin"],
        email="super@test.com",
        full_name="Super Admin",
    )


@pytest.fixture
def tenant_admin_context():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["tenant_admin"],
        email="admin@test.com",
        full_name="Tenant Admin",
    )


async def test_require_permission_success(normal_context, mock_role_repo):
    checker = require_permission("test:action:execute")
    mock_role_repo.get_user_permissions.return_value = [
        "test:action:execute",
        "other:read",
    ]

    result = await checker(context=normal_context, role_repo=mock_role_repo)
    assert result == normal_context
    mock_role_repo.get_user_permissions.assert_called_once_with(normal_context.user_id)


async def test_require_permission_denied(normal_context, mock_role_repo):
    checker = require_permission("test:action:execute")
    mock_role_repo.get_user_permissions.return_value = ["other:read"]

    with pytest.raises(
        InsufficientPermissionsError, match="Cần quyền 'test:action:execute'"
    ):
        await checker(context=normal_context, role_repo=mock_role_repo)
    mock_role_repo.get_user_permissions.assert_called_once_with(normal_context.user_id)


async def test_require_permission_superadmin_bypass(superadmin_context, mock_role_repo):
    checker = require_permission("test:action:execute")

    result = await checker(context=superadmin_context, role_repo=mock_role_repo)
    assert result == superadmin_context
    mock_role_repo.get_user_permissions.assert_not_called()


async def test_require_permission_tenant_admin_bypass(
    tenant_admin_context, mock_role_repo
):
    checker = require_permission("test:action:execute")

    result = await checker(context=tenant_admin_context, role_repo=mock_role_repo)
    assert result == tenant_admin_context
    mock_role_repo.get_user_permissions.assert_not_called()


from app.adapters.repositories.tenant_repo import SQLAlchemyTenantRepository
from app.entrypoints.dependencies import get_tenant_onboarding_use_case


@pytest.mark.asyncio
async def test_get_tenant_onboarding_use_case_injects_transactional():
    mock_keycloak = AsyncMock()
    mock_db = AsyncMock()

    use_case = await get_tenant_onboarding_use_case(
        keycloak_adapter=mock_keycloak,
        db=mock_db,
    )

    assert isinstance(use_case.tenant_repo, SQLAlchemyTenantRepository)
    assert use_case.session is mock_db
    assert use_case.tenant_repo._session is mock_db

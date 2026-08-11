# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock

import pytest

from app.core.domain.entities import TenantContext, TenantEntity
from app.core.use_cases.tenant_onboarding import (
    PermissionError,
    TenantOnboardingError,
    TenantOnboardingUseCase,
)


@pytest.fixture
def mock_tenant_repo():
    return AsyncMock()


@pytest.fixture
def mock_keycloak_adapter():
    return AsyncMock()


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.fixture
def use_case(mock_tenant_repo, mock_keycloak_adapter, mock_session):
    return TenantOnboardingUseCase(
        tenant_repo=mock_tenant_repo,
        keycloak_adapter=mock_keycloak_adapter,
        session=mock_session,
    )


@pytest.fixture
def superadmin_context():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["superadmin"],
        email="super@admin.com",
        full_name="Super Admin",
    )


@pytest.fixture
def normal_context():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["user"],
        email="user@test.com",
        full_name="Normal User",
    )


async def test_create_tenant_success(
    use_case, superadmin_context, mock_tenant_repo, mock_keycloak_adapter
):
    mock_tenant_repo.get_by_slug.return_value = None

    def create_side_effect(tenant):
        return tenant

    mock_tenant_repo.create.side_effect = create_side_effect

    result = await use_case.create_tenant(
        context=superadmin_context, name="Test Tenant", slug="test-tenant", plan="pro"
    )

    assert result.name == "Test Tenant"
    assert result.slug == "test-tenant"
    assert result.plan == "pro"
    assert result.keycloak_realm == "proteus"

    mock_tenant_repo.create.assert_called_once()
    mock_keycloak_adapter.create_tenant_group.assert_called_once_with(
        realm="proteus", group_name="tenant_test-tenant", admin_token=""
    )


async def test_create_tenant_not_superadmin(use_case, normal_context):
    with pytest.raises(PermissionError):
        await use_case.create_tenant(
            context=normal_context, name="Test", slug="test", plan="starter"
        )


async def test_create_tenant_slug_exists(
    use_case, superadmin_context, mock_tenant_repo
):
    mock_tenant_repo.get_by_slug.return_value = TenantEntity(
        id=uuid.uuid4(),
        name="Existing",
        slug="test",
        keycloak_realm="r",
        plan="starter",
        is_active=True,
    )
    with pytest.raises(TenantOnboardingError, match="đã tồn tại"):
        await use_case.create_tenant(
            context=superadmin_context, name="Test", slug="test", plan="starter"
        )


async def test_get_tenant_success(use_case, normal_context, mock_tenant_repo):
    tenant_id = normal_context.tenant_id
    mock_tenant_repo.get_by_id.return_value = TenantEntity(
        id=tenant_id,
        name="Test",
        slug="test",
        keycloak_realm="r",
        plan="starter",
        is_active=True,
    )

    result = await use_case.get_tenant(normal_context, tenant_id)
    assert result.id == tenant_id


async def test_get_tenant_unauthorized(use_case, normal_context):
    other_tenant_id = uuid.uuid4()
    with pytest.raises(PermissionError):
        await use_case.get_tenant(normal_context, other_tenant_id)


async def test_update_tenant_success(use_case, superadmin_context, mock_tenant_repo):
    tenant_id = uuid.uuid4()
    mock_tenant_repo.get_by_id.return_value = TenantEntity(
        id=tenant_id,
        name="Test",
        slug="test",
        keycloak_realm="r",
        plan="starter",
        is_active=True,
    )

    mock_tenant_repo.update.return_value = TenantEntity(
        id=tenant_id,
        name="New Name",
        slug="test",
        keycloak_realm="r",
        plan="pro",
        is_active=True,
    )

    result = await use_case.update_tenant(
        superadmin_context, tenant_id, {"name": "New Name", "plan": "pro"}
    )

    assert result.name == "New Name"
    assert result.plan == "pro"
    mock_tenant_repo.update.assert_called_once_with(
        tenant_id, {"name": "New Name", "plan": "pro"}
    )


async def test_delete_tenant_success(use_case, superadmin_context, mock_tenant_repo):
    tenant_id = uuid.uuid4()
    mock_tenant_repo.get_by_id.return_value = TenantEntity(
        id=tenant_id,
        name="Test",
        slug="test",
        keycloak_realm="r",
        plan="starter",
        is_active=True,
    )

    await use_case.delete_tenant(superadmin_context, tenant_id)
    mock_tenant_repo.soft_delete.assert_called_once_with(tenant_id)

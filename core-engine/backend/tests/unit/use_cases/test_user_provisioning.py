import uuid
import pytest
from unittest.mock import AsyncMock
from app.core.use_cases.user_provisioning import UserProvisioningUseCase
from app.core.domain.entities import TenantContext, UserEntity


@pytest.fixture
def mock_user_repo():
    repo = AsyncMock()
    return repo


@pytest.fixture
def use_case(mock_user_repo):
    return UserProvisioningUseCase(user_repo=mock_user_repo)


@pytest.mark.asyncio
async def test_sync_user_profile(use_case, mock_user_repo):
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()

    tenant_context = TenantContext(
        tenant_id=tenant_id,
        user_id=user_id,
        roles=["admin"],
        email="test@example.com",
        full_name="Test User",
    )

    expected_user = UserEntity(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        keycloak_id=user_id,
        email="test@example.com",
        full_name="Test User",
        roles=[],
        is_active=True,
    )

    mock_user_repo.upsert.return_value = expected_user

    result = await use_case.sync_user_profile(tenant_context)

    mock_user_repo.upsert.assert_called_once()
    mock_user_repo.commit.assert_called_once()

    assert result.email == "test@example.com"
    assert result.roles == ["admin"]  # Roles should be merged from context

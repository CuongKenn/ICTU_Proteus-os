import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.user_repo import UserRepository
from app.infrastructure.models import UserModel
from app.core.domain.exceptions import NotFoundError


@pytest.fixture
def mock_session():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def user_repo(mock_session):
    return UserRepository(mock_session)


@pytest.mark.asyncio
async def test_get_by_keycloak_id(user_repo, mock_session):
    # Setup mock
    keycloak_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_scalars = MagicMock()

    mock_session.execute.return_value = mock_result
    mock_result.scalars.return_value = mock_scalars

    expected_user = UserModel(id=uuid.uuid4(), keycloak_id=keycloak_id)
    mock_scalars.first.return_value = expected_user

    # Execute
    result = await user_repo.get_by_keycloak_id(keycloak_id)

    # Assert
    assert result == expected_user
    mock_session.execute.assert_called_once()
    mock_scalars.first.assert_called_once()


@pytest.mark.asyncio
async def test_upsert(user_repo, mock_session):
    # Setup mock
    user_data = {
        "keycloak_id": uuid.uuid4(),
        "email": "test@example.com",
        "full_name": "Test User",
        "tenant_id": uuid.uuid4(),
    }
    mock_result = MagicMock()

    mock_session.execute.return_value = mock_result

    expected_user = UserModel(**user_data)
    mock_result.scalar_one.return_value = expected_user

    # Execute
    result = await user_repo.upsert(user_data)

    # Assert
    assert result == expected_user
    mock_session.execute.assert_called_once()
    mock_result.scalar_one.assert_called_once()


@pytest.mark.asyncio
async def test_deactivate_success(user_repo, mock_session):
    # Setup mock
    user_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_result.rowcount = 1
    mock_session.execute.return_value = mock_result

    # Execute
    await user_repo.deactivate(user_id)

    # Assert
    mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_deactivate_not_found(user_repo, mock_session):
    # Setup mock
    user_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_result.rowcount = 0
    mock_session.execute.return_value = mock_result

    # Execute & Assert
    with pytest.raises(NotFoundError):
        await user_repo.deactivate(user_id)


@pytest.mark.asyncio
async def test_list_by_tenant(user_repo, mock_session):
    # Setup mock
    tenant_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_scalars = MagicMock()

    mock_session.execute.return_value = mock_result
    mock_result.scalars.return_value = mock_scalars

    expected_users = [UserModel(id=uuid.uuid4(), tenant_id=tenant_id) for _ in range(2)]
    mock_scalars.all.return_value = expected_users

    # Execute
    result = await user_repo.list_by_tenant(tenant_id)

    # Assert
    assert result == expected_users
    mock_session.execute.assert_called_once()
    mock_scalars.all.assert_called_once()

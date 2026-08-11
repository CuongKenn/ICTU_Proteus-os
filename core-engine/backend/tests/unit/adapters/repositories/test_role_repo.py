# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.role_repo import RoleRepository
from app.core.domain.exceptions import NotFoundError
from app.infrastructure.models import RoleModel


@pytest.fixture
def mock_session():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def role_repo(mock_session):
    return RoleRepository(mock_session)


@pytest.mark.asyncio
async def test_create_role(role_repo, mock_session):
    role_data = {
        "tenant_id": uuid.uuid4(),
        "name": "Admin",
        "permissions": ["users:read", "users:write"],
    }

    result = await role_repo.create_role(role_data)

    assert result.name == "Admin"
    assert result.permissions == ["users:read", "users:write"]
    mock_session.add.assert_called_once_with(result)
    mock_session.flush.assert_called_once()


@pytest.mark.asyncio
async def test_assign_role(role_repo, mock_session):
    user_id = uuid.uuid4()
    role_id = uuid.uuid4()
    granted_by = uuid.uuid4()

    result = await role_repo.assign_role(user_id, role_id, granted_by)

    assert result.user_id == user_id
    assert result.role_id == role_id
    assert result.granted_by_user_id == granted_by
    mock_session.add.assert_called_once_with(result)
    mock_session.flush.assert_called_once()


@pytest.mark.asyncio
async def test_revoke_role_success(role_repo, mock_session):
    user_id = uuid.uuid4()
    role_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.rowcount = 1
    mock_session.execute.return_value = mock_result

    await role_repo.revoke_role(user_id, role_id)

    mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_revoke_role_not_found(role_repo, mock_session):
    user_id = uuid.uuid4()
    role_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.rowcount = 0
    mock_session.execute.return_value = mock_result

    with pytest.raises(NotFoundError):
        await role_repo.revoke_role(user_id, role_id)

    mock_session.execute.assert_called_once()


@pytest.mark.asyncio
async def test_list_by_tenant(role_repo, mock_session):
    tenant_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_scalars = MagicMock()

    mock_session.execute.return_value = mock_result
    mock_result.scalars.return_value = mock_scalars

    expected_roles = [RoleModel(id=uuid.uuid4(), tenant_id=tenant_id)]
    mock_scalars.all.return_value = expected_roles

    result = await role_repo.list_by_tenant(tenant_id)

    assert result == expected_roles
    mock_session.execute.assert_called_once()
    mock_scalars.all.assert_called_once()


@pytest.mark.asyncio
async def test_get_user_permissions(role_repo, mock_session):
    user_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_session.execute.return_value = mock_result

    # Giả lập trả về các list permissions từ database
    mock_result.all.return_value = [
        (["users:read", "plugins:read"],),
        (["users:write"],),
        (None,),  # Trường hợp không có permissions
        ([],),
    ]

    result = await role_repo.get_user_permissions(user_id)

    assert set(result) == {"users:read", "users:write", "plugins:read"}
    mock_session.execute.assert_called_once()
    mock_result.all.assert_called_once()

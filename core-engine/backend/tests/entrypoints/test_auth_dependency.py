# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError

from app.entrypoints.dependencies import get_current_tenant_context


@pytest.fixture
def valid_credentials():
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid_token")


@pytest.fixture
def mock_keycloak():
    return AsyncMock()


def make_mock_db(keycloak_id: str | None = None, tenant_id: str | None = None):
    """Tạo mock AsyncSession để inject vào dependency."""
    db = MagicMock()
    if keycloak_id and tenant_id:
        # Mock user entity trả về từ user_repo.get_by_keycloak_id
        mock_user = MagicMock()
        mock_user.tenant_id = uuid.UUID(tenant_id)
        from app.adapters.repositories.user_repo import SQLAlchemyUserRepository
        # Patch get_by_keycloak_id trên SQLAlchemyUserRepository
        SQLAlchemyUserRepository.get_by_keycloak_id = AsyncMock(return_value=mock_user)
    else:
        from app.adapters.repositories.user_repo import SQLAlchemyUserRepository
        SQLAlchemyUserRepository.get_by_keycloak_id = AsyncMock(return_value=None)
    return db


@pytest.mark.asyncio
async def test_get_current_tenant_context_success(mock_keycloak, valid_credentials):
    """Token đầy đủ tenant_id — không cần DB lookup."""
    tenant_id = str(uuid.uuid4())
    user_sub = str(uuid.uuid4())
    mock_keycloak.verify_and_decode_token = AsyncMock(
        return_value={
            "tenant_id": tenant_id,
            "sub": user_sub,
            "realm_access": {"roles": ["tenant_admin"]},
            "email": "test@example.com",
            "name": "Test User",
        }
    )

    tenant_context = await get_current_tenant_context(
        valid_credentials,
        keycloak_adapter=mock_keycloak,
        db=MagicMock(),
    )

    assert str(tenant_context.tenant_id) == tenant_id
    assert str(tenant_context.user_id) == user_sub
    assert tenant_context.email == "test@example.com"
    assert "tenant_admin" in tenant_context.roles


@pytest.mark.asyncio
async def test_get_current_tenant_context_invalid_jwt(mock_keycloak, valid_credentials):
    """JWT không hợp lệ → 401."""
    mock_keycloak.verify_and_decode_token = AsyncMock(
        side_effect=JWTError("Invalid token")
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant_context(
            valid_credentials,
            keycloak_adapter=mock_keycloak,
            db=MagicMock(),
        )

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_tenant_context_fallback_to_db(mock_keycloak, valid_credentials):
    """Token không có tenant_id → fallback lookup DB theo keycloak sub."""
    user_sub = str(uuid.uuid4())
    real_tenant_id = str(uuid.uuid4())

    mock_keycloak.verify_and_decode_token = AsyncMock(
        return_value={
            "sub": user_sub,
            # không có tenant_id
            "realm_access": {"roles": ["tenant_admin"]},
            "email": "test@example.com",
        }
    )

    # Mock DB user lookup
    mock_user = MagicMock()
    mock_user.tenant_id = uuid.UUID(real_tenant_id)

    from app.adapters.repositories import user_repo as user_repo_module
    original = user_repo_module.SQLAlchemyUserRepository.get_by_keycloak_id
    user_repo_module.SQLAlchemyUserRepository.get_by_keycloak_id = AsyncMock(return_value=mock_user)

    try:
        tenant_context = await get_current_tenant_context(
            valid_credentials,
            keycloak_adapter=mock_keycloak,
            db=MagicMock(),
        )
        assert str(tenant_context.tenant_id) == real_tenant_id
    finally:
        user_repo_module.SQLAlchemyUserRepository.get_by_keycloak_id = original


@pytest.mark.asyncio
async def test_get_current_tenant_context_missing_tenant_no_db_record(
    mock_keycloak, valid_credentials
):
    """Token không có tenant_id VÀ không tìm thấy user trong DB → 401."""
    user_sub = str(uuid.uuid4())

    mock_keycloak.verify_and_decode_token = AsyncMock(
        return_value={
            "sub": user_sub,
            # không có tenant_id
        }
    )

    from app.adapters.repositories import user_repo as user_repo_module
    original = user_repo_module.SQLAlchemyUserRepository.get_by_keycloak_id
    user_repo_module.SQLAlchemyUserRepository.get_by_keycloak_id = AsyncMock(return_value=None)

    try:
        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant_context(
                valid_credentials,
                keycloak_adapter=mock_keycloak,
                db=MagicMock(),
            )
        assert exc_info.value.status_code == 401
    finally:
        user_repo_module.SQLAlchemyUserRepository.get_by_keycloak_id = original


@pytest.mark.asyncio
async def test_get_current_tenant_context_missing_sub(mock_keycloak, valid_credentials):
    """Token thiếu sub → 401."""
    mock_keycloak.verify_and_decode_token = AsyncMock(
        return_value={
            "tenant_id": str(uuid.uuid4()),
            # không có sub
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant_context(
            valid_credentials,
            keycloak_adapter=mock_keycloak,
            db=MagicMock(),
        )
    assert exc_info.value.status_code == 401
    assert "sub" in str(exc_info.value.detail)

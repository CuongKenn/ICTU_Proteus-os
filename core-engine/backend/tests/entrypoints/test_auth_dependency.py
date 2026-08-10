# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, patch

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
    with patch("app.entrypoints.dependencies._keycloak_adapter") as mock:
        yield mock

@pytest.mark.asyncio
async def test_get_current_tenant_context_success(mock_keycloak, valid_credentials):
    mock_keycloak.verify_and_decode_token = AsyncMock(return_value={
        "tenant_id": str(uuid.uuid4()),
        "sub": str(uuid.uuid4()),
        "realm_access": {"roles": ["admin"]},
        "email": "test@example.com"
    })
    
    tenant_context = await get_current_tenant_context(valid_credentials)
    
    assert tenant_context.email == "test@example.com"
    assert "admin" in tenant_context.roles

@pytest.mark.asyncio
async def test_get_current_tenant_context_invalid_jwt(mock_keycloak, valid_credentials):
    mock_keycloak.verify_and_decode_token = AsyncMock(side_effect=JWTError("Invalid token"))
    
    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant_context(valid_credentials)
    
    assert exc_info.value.status_code == 401
    assert "Token khA'ng h" in str(exc_info.value.detail) or "Token" in str(exc_info.value.detail)

@pytest.mark.asyncio
async def test_get_current_tenant_context_missing_tenant(mock_keycloak, valid_credentials):
    mock_keycloak.verify_and_decode_token = AsyncMock(return_value={
        "sub": str(uuid.uuid4()),
    })
    
    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant_context(valid_credentials)
        
    assert exc_info.value.status_code == 401
    assert "tenant_id" in str(exc_info.value.detail)

@pytest.mark.asyncio
async def test_get_current_tenant_context_missing_sub(mock_keycloak, valid_credentials):
    mock_keycloak.verify_and_decode_token = AsyncMock(return_value={
        "tenant_id": str(uuid.uuid4()),
    })
    
    with pytest.raises(HTTPException) as exc_info:
        await get_current_tenant_context(valid_credentials)
        
    assert exc_info.value.status_code == 401
    assert "sub" in str(exc_info.value.detail)

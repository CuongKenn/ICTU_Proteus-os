# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.adapters.external.n8n_adapter import N8nAdapterError
from app.core.domain.entities import TenantContext
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_role_repo,
)
from main import app


async def mock_get_current_tenant_context():
    return TenantContext(
        tenant_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        user_id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
        roles=["tenant_admin"],
    )


async def mock_get_role_repo():
    pass


@pytest.fixture
def override_auth():
    app.dependency_overrides[get_current_tenant_context] = (
        mock_get_current_tenant_context
    )
    app.dependency_overrides[get_role_repo] = mock_get_role_repo
    yield
    app.dependency_overrides.clear()


from app.core.use_cases.plugin_credentials import ConfigurePluginCredentialsUseCase
from app.entrypoints.dependencies import get_plugin_credentials_use_case


@pytest.mark.asyncio
async def test_configure_plugin_credentials_success(override_auth):
    mock_use_case = AsyncMock(spec=ConfigurePluginCredentialsUseCase)
    mock_use_case.execute.return_value = {
        "message": "Credential tạo thành công",
        "credential_id": "cred-123",
        "safe_name": "tenant_11111111-1111-1111-1111-111111111111_my_smtp",
    }

    app.dependency_overrides[get_plugin_credentials_use_case] = lambda: mock_use_case

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/plugins/123e4567-e89b-12d3-a456-426614174000/credentials",
            json={
                "credential_type": "smtp",
                "credential_name": "my_smtp",
                "data": {"user": "admin"},
            },
            headers={"Authorization": "Bearer fake"},
        )

    assert response.status_code == 201
    assert response.json()["credential_id"] == "cred-123"
    mock_use_case.execute.assert_called_once()

    # Cleanup
    app.dependency_overrides.pop(get_plugin_credentials_use_case, None)


@pytest.mark.asyncio
async def test_configure_plugin_credentials_failure(override_auth):
    mock_use_case = AsyncMock(spec=ConfigurePluginCredentialsUseCase)
    mock_use_case.execute.side_effect = N8nAdapterError("API Error")

    app.dependency_overrides[get_plugin_credentials_use_case] = lambda: mock_use_case

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/plugins/123e4567-e89b-12d3-a456-426614174000/credentials",
            json={
                "credential_type": "smtp",
                "credential_name": "my_smtp",
                "data": {},
            },
            headers={"Authorization": "Bearer fake"},
        )

    assert response.status_code == 400
    assert "API Error" in response.json()["detail"]

    # Cleanup
    app.dependency_overrides.pop(get_plugin_credentials_use_case, None)

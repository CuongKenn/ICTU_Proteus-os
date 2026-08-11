import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
from app.adapters.external.n8n_adapter import N8nAdapterError
from main import app
from app.core.domain.entities import TenantContext
import uuid
from app.entrypoints.dependencies import (
    require_permission,
    get_current_tenant_context,
    get_role_repo,
)


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


@pytest.mark.asyncio
async def test_configure_plugin_credentials_success(override_auth):
    # Mock N8nAdapter
    with patch("app.entrypoints.routers.plugins.N8nAdapter") as mock_adapter_class:
        mock_instance = mock_adapter_class.return_value
        mock_instance.create_credential = AsyncMock(return_value={"id": "cred-123"})
        mock_instance.aclose = AsyncMock()

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
        # Check safe_name prefix
        mock_instance.create_credential.assert_called_once()
        kwargs = mock_instance.create_credential.call_args[1]
        assert kwargs["credential_type"] == "smtp"
        assert (
            kwargs["credential_name"]
            == "tenant_11111111-1111-1111-1111-111111111111_my_smtp"
        )
        assert kwargs["data"] == {"user": "admin"}


@pytest.mark.asyncio
async def test_configure_plugin_credentials_failure(override_auth):
    with patch("app.entrypoints.routers.plugins.N8nAdapter") as mock_adapter_class:
        mock_instance = mock_adapter_class.return_value
        mock_instance.create_credential = AsyncMock(
            side_effect=N8nAdapterError("API Error")
        )
        mock_instance.aclose = AsyncMock()

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

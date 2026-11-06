# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.domain.entities import TenantContext
from app.entrypoints.dependencies import get_current_tenant_context, get_role_repo
from main import app


@pytest.fixture
def mock_unauthorized_ctx():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["viewer"],
        full_name="Regular Viewer",
    )


@pytest.mark.asyncio
async def test_list_users_forbidden_without_permission(mock_unauthorized_ctx):
    mock_role_repo = AsyncMock()
    mock_role_repo.get_user_permissions.return_value = ["other.read"]

    app.dependency_overrides[get_current_tenant_context] = lambda: mock_unauthorized_ctx
    app.dependency_overrides[get_role_repo] = lambda: mock_role_repo

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/users", headers={"Authorization": "Bearer fake"})
            assert resp.status_code == 403
            assert "users.read" in resp.json()["detail"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_roles_forbidden_without_permission(mock_unauthorized_ctx):
    mock_role_repo = AsyncMock()
    mock_role_repo.get_user_permissions.return_value = ["other.read"]

    app.dependency_overrides[get_current_tenant_context] = lambda: mock_unauthorized_ctx
    app.dependency_overrides[get_role_repo] = lambda: mock_role_repo

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/roles", headers={"Authorization": "Bearer fake"})
            assert resp.status_code == 403
            assert "roles.read" in resp.json()["detail"]
    finally:
        app.dependency_overrides.clear()

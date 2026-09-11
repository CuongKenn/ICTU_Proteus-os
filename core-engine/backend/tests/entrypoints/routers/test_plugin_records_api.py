# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Router tests cho generic records CRUD /plugins/{code}/records/."""

import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.core.domain.entities import TenantContext
from app.core.domain.exceptions import (
    DSLInvalidActionError,
    InsufficientPermissionsError,
    PluginNotFoundError,
)
from app.core.use_cases.plugin_records import PluginRecordsUseCase
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_plugin_records_use_case,
    get_role_repo,
)
from main import app


async def mock_ctx():
    return TenantContext(
        tenant_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        user_id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
        roles=["asset_user"],
    )


@pytest.fixture
def override_auth():
    app.dependency_overrides[get_current_tenant_context] = mock_ctx
    app.dependency_overrides[get_role_repo] = lambda: AsyncMock()
    yield
    app.dependency_overrides.clear()


def _override_uc(mock_uc):
    app.dependency_overrides[get_plugin_records_use_case] = lambda: mock_uc


@pytest.mark.asyncio
async def test_list_records_200(override_auth):
    mock_uc = AsyncMock(spec=PluginRecordsUseCase)
    mock_uc.list_records.return_value = {"rows": [{"id": "a"}], "total": 1}
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/plugins/asset-module/records/asset_items",
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    app.dependency_overrides.pop(get_plugin_records_use_case, None)


@pytest.mark.asyncio
async def test_list_records_unknown_table_400(override_auth):
    mock_uc = AsyncMock(spec=PluginRecordsUseCase)
    mock_uc.list_records.side_effect = DSLInvalidActionError("bad table")
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/plugins/asset-module/records/users",
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 400
    app.dependency_overrides.pop(get_plugin_records_use_case, None)


@pytest.mark.asyncio
async def test_create_record_201(override_auth):
    mock_uc = AsyncMock(spec=PluginRecordsUseCase)
    mock_uc.create_record.return_value = {"id": "n", "code": "X"}
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/plugins/asset-module/records/asset_items",
            json={"code": "X"},
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 201
    assert resp.json()["code"] == "X"
    app.dependency_overrides.pop(get_plugin_records_use_case, None)


@pytest.mark.asyncio
async def test_update_and_delete(override_auth):
    mock_uc = AsyncMock(spec=PluginRecordsUseCase)
    rid = "123e4567-e89b-12d3-a456-426614174000"
    mock_uc.update_record.return_value = {"id": rid, "name": "New"}
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.patch(
            f"/api/v1/plugins/asset-module/records/asset_items/{rid}",
            json={"name": "New"},
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 200

        resp = await client.delete(
            f"/api/v1/plugins/asset-module/records/asset_items/{rid}",
            headers={"Authorization": "Bearer fake"},
        )
        assert resp.status_code == 204

    app.dependency_overrides.pop(get_plugin_records_use_case, None)


@pytest.mark.asyncio
async def test_records_forbidden_403(override_auth):
    mock_uc = AsyncMock(spec=PluginRecordsUseCase)
    mock_uc.list_records.side_effect = InsufficientPermissionsError("deny")
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/plugins/asset-module/records/asset_items",
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 403
    app.dependency_overrides.pop(get_plugin_records_use_case, None)


@pytest.mark.asyncio
async def test_records_plugin_404(override_auth):
    mock_uc = AsyncMock(spec=PluginRecordsUseCase)
    mock_uc.delete_record.side_effect = PluginNotFoundError("gone")
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.delete(
            "/api/v1/plugins/asset-module/records/asset_items/123e4567-e89b-12d3-a456-426614174000",
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 404
    app.dependency_overrides.pop(get_plugin_records_use_case, None)

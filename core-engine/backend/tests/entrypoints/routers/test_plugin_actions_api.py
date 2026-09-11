# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Router tests cho generic dispatcher POST/GET /plugins/{code}/actions."""

import uuid
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.adapters.external.n8n_adapter import N8nAdapterError
from app.core.domain.entities import TenantContext
from app.core.domain.exceptions import (
    DSLInvalidActionError,
    InsufficientPermissionsError,
    PluginNotFoundError,
)
from app.core.use_cases.plugin_action import PluginActionUseCase
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_plugin_action_use_case,
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
    app.dependency_overrides[get_plugin_action_use_case] = lambda: mock_uc


@pytest.mark.asyncio
async def test_dispatch_success_202(override_auth):
    mock_uc = AsyncMock(spec=PluginActionUseCase)
    mock_uc.execute.return_value = {
        "task_id": "task-1",
        "action": "wf_asset_request",
        "result": {"ok": True},
    }
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/plugins/asset-module/actions/wf_asset_request",
            json={"payload": {"asset_id": "x"}},
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 202
    assert resp.json()["task_id"] == "task-1"
    app.dependency_overrides.pop(get_plugin_action_use_case, None)


@pytest.mark.asyncio
async def test_dispatch_unknown_plugin_404(override_auth):
    mock_uc = AsyncMock(spec=PluginActionUseCase)
    mock_uc.execute.side_effect = PluginNotFoundError("nope")
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/plugins/nope/actions/wf_x",
            json={"payload": {}},
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 404
    app.dependency_overrides.pop(get_plugin_action_use_case, None)


@pytest.mark.asyncio
async def test_dispatch_bad_action_400(override_auth):
    mock_uc = AsyncMock(spec=PluginActionUseCase)
    mock_uc.execute.side_effect = DSLInvalidActionError("bad")
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/plugins/asset-module/actions/nope",
            json={"payload": {}},
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 400
    app.dependency_overrides.pop(get_plugin_action_use_case, None)


@pytest.mark.asyncio
async def test_dispatch_forbidden_403(override_auth):
    mock_uc = AsyncMock(spec=PluginActionUseCase)
    mock_uc.execute.side_effect = InsufficientPermissionsError("deny")
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/plugins/asset-module/actions/wf_asset_request",
            json={"payload": {}},
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 403
    app.dependency_overrides.pop(get_plugin_action_use_case, None)


@pytest.mark.asyncio
async def test_dispatch_n8n_down_502(override_auth):
    mock_uc = AsyncMock(spec=PluginActionUseCase)
    mock_uc.execute.side_effect = N8nAdapterError("n8n down")
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/plugins/asset-module/actions/wf_asset_request",
            json={"payload": {}},
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 502
    app.dependency_overrides.pop(get_plugin_action_use_case, None)


@pytest.mark.asyncio
async def test_list_actions_200(override_auth):
    mock_uc = AsyncMock(spec=PluginActionUseCase)
    mock_uc.list_actions.return_value = [
        {
            "action": "wf_asset_request",
            "name": "Đề xuất cấp phát",
            "description": None,
            "trigger": "webhook",
        }
    ]
    _override_uc(mock_uc)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/plugins/asset-module/actions",
            headers={"Authorization": "Bearer fake"},
        )

    assert resp.status_code == 200
    assert resp.json()["actions"][0]["action"] == "wf_asset_request"
    app.dependency_overrides.pop(get_plugin_action_use_case, None)

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Regression #682: plugin install không được tự kẹt INSTALLING."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain.entities import PluginEntity, PluginStatus, TenantContext
from app.core.use_cases.plugin_install import PluginInstallError, PluginInstallUseCase
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_plugin_repo_write,
    get_role_repo,
)
from main import app

TENANT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
PLUGIN_ID = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")


class _GuardPassed(Exception):
    """Sentinel: guard đã qua, use case tiến tới bước parse manifest."""


def _ctx() -> TenantContext:
    return TenantContext(tenant_id=TENANT_ID, user_id=uuid.uuid4(), roles=["admin"])


def _use_case(repo: AsyncMock) -> PluginInstallUseCase:
    parser = MagicMock()
    parser.parse.side_effect = _GuardPassed
    return PluginInstallUseCase(
        plugin_repo=repo,
        manifest_parser=parser,
        n8n_adapter=AsyncMock(),
        metabase_adapter=AsyncMock(),
        appsmith_adapter=AsyncMock(),
        keycloak_adapter=AsyncMock(),
        mattermost_adapter=AsyncMock(),
        session=AsyncMock(spec=AsyncSession),
    )


def _repo(status: PluginStatus | None, own_task: uuid.UUID | None = None):
    plugin = PluginEntity(
        id=PLUGIN_ID, code_name="hr-module", display_name="HR", version="1.0.0"
    )
    repo = AsyncMock()
    repo.get_by_code_name.return_value = plugin
    repo.get_installation_status.return_value = status
    if own_task is not None:
        repo.get_installation_status_by_task_id.return_value = (
            PluginStatus.INSTALLING,
            PLUGIN_ID,
        )
    else:
        repo.get_installation_status_by_task_id.return_value = None
    return repo


async def test_worker_accepts_installing_created_by_same_request():
    task_id = uuid.uuid4()
    uc = _use_case(_repo(PluginStatus.INSTALLING, own_task=task_id))
    with pytest.raises(_GuardPassed):
        await uc.execute(_ctx(), "hr-module", install_task_id=task_id)


async def test_worker_rejects_installing_from_another_request():
    uc = _use_case(_repo(PluginStatus.INSTALLING))
    with pytest.raises(PluginInstallError, match="đang trong quá trình cài đặt"):
        await uc.execute(_ctx(), "hr-module", install_task_id=uuid.uuid4())


async def test_worker_rejects_installing_without_task_id():
    uc = _use_case(_repo(PluginStatus.INSTALLING))
    with pytest.raises(PluginInstallError):
        await uc.execute(_ctx(), "hr-module")


@pytest.fixture
def override_deps():
    async def _ctx_override():
        return TenantContext(
            tenant_id=TENANT_ID, user_id=uuid.uuid4(), roles=["tenant_admin"]
        )

    app.dependency_overrides[get_current_tenant_context] = _ctx_override
    app.dependency_overrides[get_role_repo] = lambda: None
    yield
    app.dependency_overrides.clear()


def _endpoint_repo(current_status: PluginStatus | None) -> AsyncMock:
    repo = AsyncMock()
    repo.get_by_id.return_value = PluginEntity(
        id=PLUGIN_ID, code_name="hr-module", display_name="HR", version="1.0.0"
    )
    repo.get_installation_status.return_value = current_status
    repo._session = AsyncMock()
    return repo


@pytest.mark.parametrize(
    "current",
    [PluginStatus.ACTIVE, PluginStatus.INSTALLING, PluginStatus.UNINSTALLING],
)
async def test_endpoint_returns_409_and_does_not_queue(override_deps, current):
    repo = _endpoint_repo(current)
    app.dependency_overrides[get_plugin_repo_write] = lambda: repo
    with patch(
        "app.entrypoints.routers.plugins._run_install_plugin_background",
        new=MagicMock(),
    ) as bg:
        async with AsyncClient(app=app, base_url="http://test") as client:
            resp = await client.post(
                f"/api/v1/plugins/{PLUGIN_ID}/install",
                json={},
                headers={"Authorization": "Bearer fake"},
            )
    assert resp.status_code == 409
    repo.upsert_installation.assert_not_called()
    bg.assert_not_called()


async def test_endpoint_queues_install_with_task_id_when_not_installed(override_deps):
    repo = _endpoint_repo(None)
    app.dependency_overrides[get_plugin_repo_write] = lambda: repo

    async def _noop(**_kwargs):
        return None

    with patch(
        "app.entrypoints.routers.plugins._run_install_plugin_background",
        new=MagicMock(side_effect=lambda **kw: _noop(**kw)),
    ) as bg:
        async with AsyncClient(app=app, base_url="http://test") as client:
            resp = await client.post(
                f"/api/v1/plugins/{PLUGIN_ID}/install",
                json={},
                headers={"Authorization": "Bearer fake"},
            )
    assert resp.status_code == 200 or resp.status_code == 202
    body = resp.json()
    assert body["status"] == "INSTALLING"
    kwargs = bg.call_args.kwargs
    assert str(kwargs["install_task_id"]) == body["task_id"]
    assert kwargs["plugin_id"] == PLUGIN_ID

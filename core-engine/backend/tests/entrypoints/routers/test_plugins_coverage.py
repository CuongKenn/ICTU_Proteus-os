# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Coverage bổ sung cho plugins router: error paths + lifecycle (mock, no DB)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import IntegrityError

from app.adapters.external.n8n_adapter import N8nAdapterError
from app.core.domain.entities import PluginEntity, PluginStatus, TenantContext
from app.core.use_cases.plugin_toggle import PluginToggleError
from app.core.use_cases.plugin_upgrade import PluginUpgradeError
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_plugin_action_use_case,
    get_plugin_list_use_case,
    get_plugin_records_use_case,
    get_plugin_repo,
    get_plugin_repo_write,
    get_plugin_toggle_use_case,
    get_plugin_upgrade_use_case,
    get_role_repo,
)
from app.entrypoints.routers.plugins import (
    _entity_to_detail_response,
    _entity_to_response,
)
from main import app

TENANT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
PLUGIN_ID = uuid.UUID("123e4567-e89b-12d3-a456-426614174001")


async def _mock_ctx():
    return TenantContext(
        tenant_id=TENANT_ID, user_id=USER_ID, roles=["tenant_admin"]
    )


@pytest.fixture
def auth():
    app.dependency_overrides[get_current_tenant_context] = _mock_ctx
    app.dependency_overrides[get_role_repo] = lambda: AsyncMock()
    yield
    app.dependency_overrides.clear()


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _entity(**kw):
    base = dict(
        id=PLUGIN_ID, code_name="hr-module", display_name="HR",
        version="1.0.0", status=PluginStatus.ACTIVE,
    )
    base.update(kw)
    return PluginEntity(**base)


# ─── helpers ────────────────────────────────────────────────────────────────


def test_entity_to_response_helpers():
    r = _entity_to_response(_entity())
    assert r.code_name == "hr-module" and r.tags == []
    d = _entity_to_detail_response(_entity())
    assert d.code_name == "hr-module" and d.screenshots == []


# ─── list / detail ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_marketplace_and_category_filter(auth):
    uc = AsyncMock()
    uc.list_marketplace.return_value = (
        [_entity(), _entity(code_name="crm-module", category="CRM")], 2
    )
    app.dependency_overrides[get_plugin_list_use_case] = lambda: uc
    try:
        async with _client() as c:
            resp = await c.get(
                "/api/v1/plugins", headers={"Authorization": "Bearer x"}
            )
        assert resp.status_code == 200 and resp.json()["total"] == 2
        async with _client() as c:
            resp = await c.get(
                "/api/v1/plugins?category=CRM",
                headers={"Authorization": "Bearer x"},
            )
        assert resp.json()["total"] == 1
    finally:
        app.dependency_overrides.pop(get_plugin_list_use_case, None)


@pytest.mark.asyncio
async def test_list_installed(auth):
    uc = AsyncMock()
    uc.list_installed.return_value = ([_entity()], 1)
    app.dependency_overrides[get_plugin_list_use_case] = lambda: uc
    try:
        async with _client() as c:
            resp = await c.get(
                "/api/v1/plugins/installed", headers={"Authorization": "Bearer x"}
            )
        assert resp.status_code == 200 and resp.json()["total"] == 1
    finally:
        app.dependency_overrides.pop(get_plugin_list_use_case, None)


@pytest.mark.asyncio
async def test_get_detail_404_and_200(auth):
    repo = AsyncMock()
    repo.get_by_id.return_value = None
    app.dependency_overrides[get_plugin_repo] = lambda: repo
    try:
        async with _client() as c:
            resp = await c.get(
                f"/api/v1/plugins/{PLUGIN_ID}", headers={"Authorization": "Bearer x"}
            )
        assert resp.status_code == 404
        repo.get_by_id.return_value = _entity()
        async with _client() as c:
            resp = await c.get(
                f"/api/v1/plugins/{PLUGIN_ID}", headers={"Authorization": "Bearer x"}
            )
        assert resp.status_code == 200
        assert resp.json()["code_name"] == "hr-module"
    finally:
        app.dependency_overrides.pop(get_plugin_repo, None)


# ─── install / uninstall ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_install_404(auth):
    repo = AsyncMock()
    repo.get_by_id.return_value = None
    app.dependency_overrides[get_plugin_repo_write] = lambda: repo
    try:
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/plugins/{PLUGIN_ID}/install",
                json={}, headers={"Authorization": "Bearer x"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_plugin_repo_write, None)


@pytest.mark.asyncio
async def test_install_202_queued(auth):
    repo = AsyncMock()
    repo.get_by_id.return_value = _entity()
    app.dependency_overrides[get_plugin_repo_write] = lambda: repo
    try:
        with patch(
            "app.entrypoints.routers.plugins._run_install_plugin_background",
            new=AsyncMock(),
        ):
            async with _client() as c:
                resp = await c.post(
                    f"/api/v1/plugins/{PLUGIN_ID}/install",
                    json={"credentials": []},
                    headers={"Authorization": "Bearer x"},
                )
        assert resp.status_code == 202
        assert resp.json()["status"] == "INSTALLING"
    finally:
        app.dependency_overrides.pop(get_plugin_repo_write, None)


@pytest.mark.asyncio
async def test_uninstall_paths(auth):
    repo = AsyncMock()
    repo.get_by_id.return_value = None
    app.dependency_overrides[get_plugin_repo_write] = lambda: repo
    try:
        async with _client() as c:
            resp = await c.request(
                "DELETE", f"/api/v1/plugins/{PLUGIN_ID}/uninstall",
                json={"confirm_name": "hr-module"},
                headers={"Authorization": "Bearer x"},
            )
        assert resp.status_code == 404
        repo.get_by_id.return_value = _entity()
        async with _client() as c:
            resp = await c.request(
                "DELETE", f"/api/v1/plugins/{PLUGIN_ID}/uninstall",
                json={"confirm_name": "wrong-name"},
                headers={"Authorization": "Bearer x"},
            )
        assert resp.status_code == 400
        with patch(
            "app.entrypoints.routers.plugins._run_uninstall_plugin_background",
            new=AsyncMock(),
        ):
            async with _client() as c:
                resp = await c.request(
                    "DELETE", f"/api/v1/plugins/{PLUGIN_ID}/uninstall",
                    json={"confirm_name": "hr-module"},
                    headers={"Authorization": "Bearer x"},
                )
        assert resp.status_code == 202
        assert resp.json()["status"] == "UNINSTALLING"
    finally:
        app.dependency_overrides.pop(get_plugin_repo_write, None)


# ─── toggle ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_disable_enable(auth):
    uc = AsyncMock()
    app.dependency_overrides[get_plugin_toggle_use_case] = lambda: uc
    try:
        async with _client() as c:
            assert (await c.post(
                f"/api/v1/plugins/{PLUGIN_ID}/disable",
                headers={"Authorization": "Bearer x"})).status_code == 200
            assert (await c.post(
                f"/api/v1/plugins/{PLUGIN_ID}/enable",
                headers={"Authorization": "Bearer x"})).status_code == 200
        uc.disable_plugin.side_effect = PluginToggleError("cannot disable")
        uc.enable_plugin.side_effect = PluginToggleError("cannot enable")
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/plugins/{PLUGIN_ID}/disable",
                headers={"Authorization": "Bearer x"})
            assert resp.status_code == 400
            resp = await c.post(
                f"/api/v1/plugins/{PLUGIN_ID}/enable",
                headers={"Authorization": "Bearer x"})
            assert resp.status_code == 400
    finally:
        app.dependency_overrides.pop(get_plugin_toggle_use_case, None)


# ─── upgrade ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upgrade_error_and_queued(auth):
    uc = AsyncMock()
    uc.prepare_upgrade.side_effect = PluginUpgradeError("no update")
    app.dependency_overrides[get_plugin_upgrade_use_case] = lambda: uc
    repo = AsyncMock()
    app.dependency_overrides[get_plugin_repo] = lambda: repo
    try:
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/plugins/{PLUGIN_ID}/upgrade",
                headers={"Authorization": "Bearer x"})
        assert resp.status_code == 400
        uc.prepare_upgrade.side_effect = None
        uc.prepare_upgrade.return_value = (_entity(), "1.0.0", "1.1.0")
        with patch(
            "app.entrypoints.routers.plugins._run_upgrade_plugin_background",
            new=AsyncMock(),
        ):
            async with _client() as c:
                resp = await c.post(
                    f"/api/v1/plugins/{PLUGIN_ID}/upgrade",
                    headers={"Authorization": "Bearer x"})
        assert resp.status_code == 202
        assert resp.json()["status"] == "UPGRADING"
    finally:
        app.dependency_overrides.pop(get_plugin_upgrade_use_case, None)
        app.dependency_overrides.pop(get_plugin_repo, None)


@pytest.mark.asyncio
async def test_upgrade_status_paths(auth):
    repo = AsyncMock()
    repo.get_upgrade_status_by_task_id.return_value = None
    repo.get_install_steps_log.return_value = []
    app.dependency_overrides[get_plugin_repo] = lambda: repo
    task = str(uuid.uuid4())
    try:
        async with _client() as c:
            resp = await c.get(
                "/api/v1/plugins/upgrade/not-a-uuid/status",
                headers={"Authorization": "Bearer x"})
            assert resp.status_code == 400
            resp = await c.get(
                f"/api/v1/plugins/upgrade/{task}/status",
                headers={"Authorization": "Bearer x"})
            assert resp.status_code == 404
        repo.get_upgrade_status_by_task_id.return_value = (
            PluginStatus.ACTIVE, PLUGIN_ID,
        )
        repo.get_install_steps_log.return_value = [
            {"step": "queued", "status": "DONE", "at": None, "message": "m"}
        ]
        async with _client() as c:
            resp = await c.get(
                f"/api/v1/plugins/upgrade/{task}/status",
                headers={"Authorization": "Bearer x"})
        assert resp.status_code == 200
        assert resp.json()["overall_status"] == "ACTIVE"
    finally:
        app.dependency_overrides.pop(get_plugin_repo, None)


@pytest.mark.asyncio
async def test_install_status_with_steps(auth):
    repo = AsyncMock()
    repo.get_installation_status_by_task_id.return_value = (
        PluginStatus.INSTALLING, PLUGIN_ID,
    )
    repo.get_install_steps_log.return_value = [{"step": "db", "status": "DONE"}]
    app.dependency_overrides[get_plugin_repo] = lambda: repo
    try:
        async with _client() as c:
            resp = await c.get(
                f"/api/v1/plugins/install/{uuid.uuid4()}/status",
                headers={"Authorization": "Bearer x"})
        assert resp.status_code == 200
        assert resp.json()["steps"][0]["step"] == "db"
    finally:
        app.dependency_overrides.pop(get_plugin_repo, None)


# ─── dispatcher / records error paths ───────────────────────────────────────


@pytest.mark.asyncio
async def test_dispatch_n8n_down_502(auth):
    uc = AsyncMock()
    uc.execute.side_effect = N8nAdapterError("n8n down")
    app.dependency_overrides[get_plugin_action_use_case] = lambda: uc
    try:
        async with _client() as c:
            resp = await c.post(
                "/api/v1/plugins/hr-module/actions/wf_x",
                json={"payload": {}},
                headers={"Authorization": "Bearer x"},
            )
        assert resp.status_code == 502
    finally:
        app.dependency_overrides.pop(get_plugin_action_use_case, None)


@pytest.mark.asyncio
async def test_records_conflict_409(auth):
    uc = AsyncMock()
    uc.create_record.side_effect = IntegrityError("s", "p", Exception("dup"))
    uc.update_record.side_effect = IntegrityError("s", "p", Exception("dup"))
    app.dependency_overrides[get_plugin_records_use_case] = lambda: uc
    try:
        async with _client() as c:
            resp = await c.post(
                "/api/v1/plugins/hr-module/records/employees",
                json={"code": "E1"},
                headers={"Authorization": "Bearer x"},
            )
            assert resp.status_code == 409
            resp = await c.patch(
                "/api/v1/plugins/hr-module/records/employees/r1",
                json={"code": "E1"},
                headers={"Authorization": "Bearer x"},
            )
            assert resp.status_code == 409
    finally:
        app.dependency_overrides.pop(get_plugin_records_use_case, None)


# ─── reload / synthesize / credentials ──────────────────────────────────────


@pytest.mark.asyncio
async def test_reload_no_loader_501(auth):
    if hasattr(app.state, "plugin_loader"):
        delattr(app.state, "plugin_loader")
    async with _client() as c:
        resp = await c.post(
            "/api/v1/plugins/reload", headers={"Authorization": "Bearer x"}
        )
    assert resp.status_code == 501


@pytest.mark.asyncio
async def test_reload_with_loader(auth):
    loader = SimpleNamespace(load_all_plugins=lambda: None)
    app.state.plugin_loader = loader
    try:
        async with _client() as c:
            resp = await c.post(
                "/api/v1/plugins/reload", headers={"Authorization": "Bearer x"}
            )
        assert resp.status_code == 200
    finally:
        delattr(app.state, "plugin_loader")


@pytest.mark.asyncio
async def test_synthesize_success_and_failure(auth):
    with patch("app.ai.plugin_synthesizer.PluginSynthesizer") as synth_cls:
        synth_cls.return_value.synthesize = AsyncMock(return_value="new-module")
        async with _client() as c:
            resp = await c.post(
                "/api/v1/plugins/synthesize",
                json={"prompt": "Tạo plugin quản lý kho"},
                headers={"Authorization": "Bearer x"},
            )
        assert resp.status_code == 200
        assert resp.json()["plugin_code_name"] == "new-module"
        synth_cls.return_value.synthesize = AsyncMock(
            side_effect=RuntimeError("llm down")
        )
        async with _client() as c:
            resp = await c.post(
                "/api/v1/plugins/synthesize",
                json={"prompt": "fail case"},
                headers={"Authorization": "Bearer x"},
            )
        assert resp.status_code == 500


@pytest.mark.asyncio
async def test_configure_credentials_generic_500(auth):
    from app.entrypoints.dependencies import get_plugin_credentials_use_case

    uc = AsyncMock()
    uc.execute.side_effect = RuntimeError("unexpected")
    app.dependency_overrides[get_plugin_credentials_use_case] = lambda: uc
    try:
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/plugins/{PLUGIN_ID}/credentials",
                json={"credential_type": "smtp",
                      "credential_name": "m",
                      "data": {"user": "a"}},
                headers={"Authorization": "Bearer x"},
            )
        assert resp.status_code == 500
    finally:
        app.dependency_overrides.pop(get_plugin_credentials_use_case, None)

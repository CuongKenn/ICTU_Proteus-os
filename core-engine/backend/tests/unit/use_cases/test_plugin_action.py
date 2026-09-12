# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Unit tests cho Generic Plugin Action Dispatcher (UI → n8n)."""

import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.adapters.external.n8n_adapter import N8nAdapterError
from app.core.domain.entities import PluginStatus, TenantContext
from app.core.domain.exceptions import (
    DSLInvalidActionError,
    DSLInvalidParametersError,
    DSLPluginNotActiveError,
    InsufficientPermissionsError,
    PluginNotFoundError,
)
from app.core.use_cases.plugin_action import PluginActionUseCase


def _wf(id=None, trigger="webhook", file="workflows/asset_request.json"):
    return SimpleNamespace(
        id=id, file=file, name="WF", description="d", trigger=trigger
    )


def _manifest(workflows):
    return SimpleNamespace(workflows=workflows)


@pytest.fixture
def ctx():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["asset_user"],
    )


@pytest.fixture
def admin_ctx():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["tenant_admin"],
    )


def _make_uc(tmp_path, workflows, installed=PluginStatus.ACTIVE, perms=None):
    # Workflow JSON giả có webhook node path cố định.
    wf_dir = tmp_path / "asset-module" / "workflows"
    wf_dir.mkdir(parents=True)
    (wf_dir / "asset_request.json").write_text(
        json.dumps(
            {
                "nodes": [
                    {
                        "type": "n8n-nodes-base.webhook",
                        "parameters": {"path": "asset/request"},
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    parser = MagicMock()
    parser.parse.return_value = _manifest(workflows)
    parser.plugins_dir = tmp_path

    repo = AsyncMock()
    repo.get_by_code_name.return_value = SimpleNamespace(id=uuid.uuid4())
    repo.get_installation_status.return_value = installed

    role_repo = AsyncMock()
    role_repo.get_user_permissions.return_value = (
        perms if perms is not None else ["asset:items:read"]
    )

    n8n = AsyncMock()
    n8n.trigger_webhook.return_value = {"ok": True}

    uc = PluginActionUseCase(
        plugin_repo=repo,
        manifest_parser=parser,
        n8n_adapter=n8n,
        role_repo=role_repo,
    )
    return uc, repo, role_repo, n8n


async def test_list_actions_only_webhook(tmp_path, ctx):
    uc, _, _, _ = _make_uc(
        tmp_path,
        [
            _wf(id="wf_asset_request", trigger="webhook"),
            _wf(id="wf_cron", trigger="cron", file="workflows/cron.json"),
        ],
    )
    actions = await uc.list_actions(ctx, "asset-module")
    assert [a["action"] for a in actions] == ["wf_asset_request"]


async def test_execute_success_envelope(tmp_path, ctx):
    uc, _, _, n8n = _make_uc(tmp_path, [_wf(id="wf_asset_request")])
    out = await uc.execute(
        ctx, "asset-module", "wf_asset_request", {"asset_id": "x"}
    )
    assert out["action"] == "wf_asset_request"
    assert out["result"] == {"ok": True}
    assert out["task_id"]
    _, envelope = n8n.trigger_webhook.call_args[0]
    assert envelope["tenant_id"] == str(ctx.tenant_id)
    # Body phẳng để workflow đọc $json.body.asset_id trực tiếp.
    assert envelope["asset_id"] == "x"
    assert "data" not in envelope
    url = n8n.trigger_webhook.call_args[0][0]
    assert url.endswith("/webhook/asset/request")


async def test_execute_id_fallback_file_stem(tmp_path, ctx):
    uc, _, _, n8n = _make_uc(tmp_path, [_wf(id=None)])
    out = await uc.execute(ctx, "asset-module", "asset_request", {})
    assert out["action"] == "asset_request"
    n8n.trigger_webhook.assert_called_once()


async def test_execute_unknown_action(tmp_path, ctx):
    uc, _, _, _ = _make_uc(tmp_path, [_wf(id="wf_asset_request")])
    with pytest.raises(DSLInvalidActionError):
        await uc.execute(ctx, "asset-module", "nope", {})


async def test_execute_cron_rejected(tmp_path, ctx):
    uc, _, _, _ = _make_uc(
        tmp_path,
        [_wf(id="wf_cron", trigger="cron", file="workflows/asset_request.json")],
    )
    with pytest.raises(DSLInvalidParametersError, match="cron"):
        await uc.execute(ctx, "asset-module", "wf_cron", {})


async def test_execute_not_installed(tmp_path, ctx):
    uc, _, _, _ = _make_uc(
        tmp_path, [_wf(id="wf_asset_request")], installed=PluginStatus.INSTALLING
    )
    with pytest.raises(DSLPluginNotActiveError):
        await uc.execute(ctx, "asset-module", "wf_asset_request", {})


async def test_execute_forbidden_without_prefix_perm(tmp_path, ctx):
    uc, _, _, _ = _make_uc(
        tmp_path, [_wf(id="wf_asset_request")], perms=["hr:employees:read"]
    )
    with pytest.raises(InsufficientPermissionsError):
        await uc.execute(ctx, "asset-module", "wf_asset_request", {})


async def test_execute_admin_bypass(tmp_path, admin_ctx):
    uc, _, role_repo, n8n = _make_uc(
        tmp_path, [_wf(id="wf_asset_request")], perms=[]
    )
    await uc.execute(admin_ctx, "asset-module", "wf_asset_request", {})
    role_repo.get_user_permissions.assert_not_called()
    n8n.trigger_webhook.assert_called_once()


async def test_execute_n8n_error_propagates(tmp_path, ctx):
    uc, _, _, n8n = _make_uc(tmp_path, [_wf(id="wf_asset_request")])
    n8n.trigger_webhook.side_effect = N8nAdapterError("n8n down")
    with pytest.raises(N8nAdapterError):
        await uc.execute(ctx, "asset-module", "wf_asset_request", {})


async def test_execute_payload_too_large(tmp_path, ctx):
    uc, _, _, _ = _make_uc(tmp_path, [_wf(id="wf_asset_request")])
    with pytest.raises(DSLInvalidParametersError, match="vượt quá"):
        await uc.execute(ctx, "asset-module", "wf_asset_request", {"big": "x" * (200 * 1024)})


async def test_execute_bad_code_format(tmp_path, ctx):
    uc, _, _, _ = _make_uc(tmp_path, [_wf(id="wf_asset_request")])
    with pytest.raises(PluginNotFoundError):
        await uc.execute(ctx, "BAD_CODE!!", "wf_asset_request", {})

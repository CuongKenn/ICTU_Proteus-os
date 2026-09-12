# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Tests cho Mattermost team-per-tenant isolation."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from app.adapters.external.mattermost_adapter import (
    MattermostAdapter,
    MattermostAdapterError,
)
from app.core.use_cases.tenant_onboarding import (
    ensure_tenant_mattermost_team,
    mattermost_team_name,
)


def test_team_name_slug():
    assert mattermost_team_name("QTech") == "tenant-qtech"
    assert mattermost_team_name("Cong Ty A&B") == "tenant-cong-ty-a-b"
    assert mattermost_team_name("Test") == "tenant-test"


def _adapter(handler):
    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport)
    adapter = MattermostAdapter(client=client)
    adapter.token = "bot-token"
    adapter.headers = {"Authorization": "Bearer bot-token"}
    return adapter


@pytest.mark.asyncio
async def test_get_team_by_name_404_returns_none():
    def handler(request):
        return httpx.Response(404, json={"message": "not found"})

    adapter = _adapter(handler)
    assert await adapter.get_team_by_name("tenant-x") is None


@pytest.mark.asyncio
async def test_create_channel_conflict_falls_back_to_get():
    calls = []

    def handler(request):
        calls.append(request.url.path)
        if request.url.path == "/api/v4/channels":
            return httpx.Response(400, json={"message": "exists"})
        return httpx.Response(200, json={"id": "chan-1", "name": "c"})

    adapter = _adapter(handler)
    out = await adapter.create_channel("team-1", "c", "C")
    assert out["id"] == "chan-1"
    assert any("name/c" in p for p in calls)


@pytest.mark.asyncio
async def test_ensure_user_reuses_existing():
    def handler(request):
        path = request.url.path
        if path == "/api/v4/users/search":
            return httpx.Response(
                200, json=[{"id": "u-1", "email": "a@x.vn"}]
            )
        if path.endswith("/members"):
            return httpx.Response(201, json={"ok": True})
        raise AssertionError(f"unexpected call {path}")

    adapter = _adapter(handler)
    user = await adapter.ensure_user_in_team_by_email(
        "team-1", "a@x.vn", "a", "secret"
    )
    assert user["id"] == "u-1"


@pytest.mark.asyncio
async def test_ensure_tenant_team_creates_and_stores():
    tenant_id = uuid.uuid4()
    repo = AsyncMock()
    repo.get_by_id.return_value = SimpleNamespace(
        id=tenant_id, slug="QTech", name="QTech"
    )
    mm = AsyncMock()
    mm.get_team_by_name.return_value = None
    mm.create_team.return_value = {"id": "team-9", "name": "tenant-qtech"}
    mm.create_channel.return_value = {"id": "chan-9"}

    cfg = await ensure_tenant_mattermost_team(repo, mm, tenant_id)
    assert cfg == {
        "team_id": "team-9",
        "team_name": "tenant-qtech",
        "alerts_channel_id": "chan-9",
    }
    mm.create_team.assert_called_once()
    repo.upsert_integration_config.assert_called_once_with(
        tenant_id, "mattermost", cfg
    )


@pytest.mark.asyncio
async def test_ensure_tenant_team_reuses_existing():
    tenant_id = uuid.uuid4()
    repo = AsyncMock()
    repo.get_by_id.return_value = SimpleNamespace(
        id=tenant_id, slug="QTech", name="QTech"
    )
    mm = AsyncMock()
    mm.get_team_by_name.return_value = {"id": "team-9", "name": "tenant-qtech"}
    mm.create_channel.return_value = {"id": "chan-9"}

    await ensure_tenant_mattermost_team(repo, mm, tenant_id)
    mm.create_team.assert_not_called()
    mm.create_channel.assert_called_once()

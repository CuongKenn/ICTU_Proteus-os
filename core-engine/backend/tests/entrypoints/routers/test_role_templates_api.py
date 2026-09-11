# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Tests cho Role Templates (apply idempotent + router)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.core.domain.entities import TenantContext
from app.core.domain.role_templates import TEMPLATES, list_templates
from app.core.use_cases.role_management import RoleManagementUseCase
from app.entrypoints.dependencies import get_current_tenant_context, get_role_repo
from app.entrypoints.routers.roles import get_role_use_case
from main import app


def test_templates_valid():
    assert set(TEMPLATES) == {"sme", "school", "government"}
    for key, t in TEMPLATES.items():
        assert t["key"] == key
        assert len(t["roles"]) >= 3
        for r in t["roles"]:
            assert r["name"] and r["display_name"]
            assert isinstance(r["permissions"], list)


def test_list_templates_summary():
    assert {t["key"] for t in list_templates()} == {"sme", "school", "government"}


@pytest.mark.asyncio
async def test_apply_template_idempotent():
    repo = AsyncMock()
    repo.list_by_tenant.return_value = [SimpleNamespace(name="staff")]
    repo.create_role.side_effect = lambda d: SimpleNamespace(**d)
    uc = RoleManagementUseCase(repo, None)
    out = await uc.apply_role_template(uuid.uuid4(), "sme")
    assert "staff" in out["skipped"]
    assert "general_manager" in out["created"]
    assert repo.create_role.call_count == 4


@pytest.mark.asyncio
async def test_apply_template_unknown():
    uc = RoleManagementUseCase(AsyncMock(), None)
    with pytest.raises(ValueError):
        await uc.apply_role_template(uuid.uuid4(), "nope")


async def _mock_ctx():
    return TenantContext(
        tenant_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        user_id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
        roles=["tenant_admin"],
    )


@pytest.fixture
def override_auth():
    app.dependency_overrides[get_current_tenant_context] = _mock_ctx
    app.dependency_overrides[get_role_repo] = lambda: AsyncMock()
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_router_templates_and_apply(override_auth):
    mock_uc = AsyncMock(spec=RoleManagementUseCase)
    mock_uc.list_role_templates.return_value = [
        {"key": "sme", "name": "SME", "description": "d", "roles_count": 5}
    ]
    mock_uc.apply_role_template.return_value = {
        "created": ["staff"],
        "skipped": [],
    }
    app.dependency_overrides[get_role_use_case] = lambda: mock_uc

    async with AsyncClient(app=app, base_url="http://test") as client:
        r1 = await client.get(
            "/api/v1/roles/templates", headers={"Authorization": "Bearer x"}
        )
        assert r1.status_code == 200
        assert r1.json()[0]["key"] == "sme"

        r2 = await client.post(
            "/api/v1/roles/apply-template",
            json={"template_key": "sme"},
            headers={"Authorization": "Bearer x"},
        )
        assert r2.status_code == 200
        assert r2.json()["created"] == ["staff"]

        mock_uc.apply_role_template.side_effect = ValueError("nope")
        r3 = await client.post(
            "/api/v1/roles/apply-template",
            json={"template_key": "nope"},
            headers={"Authorization": "Bearer x"},
        )
        assert r3.status_code == 400

    app.dependency_overrides.pop(get_role_use_case, None)

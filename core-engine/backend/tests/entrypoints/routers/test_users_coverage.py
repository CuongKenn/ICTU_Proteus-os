# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Coverage bổ sung cho users router: validation + error paths (mock, no DB)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import Request
from httpx import ASGITransport, AsyncClient

from app.core.domain.entities import TenantContext
from app.core.domain.exceptions import NotFoundError
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_db_transactional,
    get_keycloak_adapter,
    get_mattermost_adapter,
    get_role_repo,
)
from app.entrypoints.routers.users import (
    InviteUserRequest,
    _invite_redirect_uri,
    _sanitize_mm_username,
)
from main import app

TENANT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
OTHER_USER = uuid.UUID("33333333-3333-3333-3333-333333333333")


async def _mock_ctx():
    return TenantContext(tenant_id=TENANT_ID, user_id=USER_ID, roles=["tenant_admin"])


@pytest.fixture
def client_overrides():
    app.dependency_overrides[get_current_tenant_context] = _mock_ctx
    app.dependency_overrides[get_role_repo] = lambda: AsyncMock()
    app.dependency_overrides[get_db_transactional] = lambda: AsyncMock()
    kc = AsyncMock()
    mm = AsyncMock()
    app.dependency_overrides[get_keycloak_adapter] = lambda: kc
    app.dependency_overrides[get_mattermost_adapter] = lambda: mm
    yield SimpleNamespace(kc=kc, mm=mm)
    app.dependency_overrides.clear()


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _user_entity(**kw):
    base = dict(
        id=uuid.uuid4(), tenant_id=TENANT_ID, keycloak_id=OTHER_USER,
        email="nv@example.com", full_name="Nhan Vien", roles=[],
        is_active=False, last_login_at=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


# ─── pure helpers ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("John.Doe", "john.doe"),
        ("User@Example.COM", "user"),
        ("Nguyễn Văn A!", "nguy-n-v-n-a"),
        ("", None),  # fallback user-xxxx
        ("!!!", None),
        ("a" * 100, "a" * 64),
    ],
)
def test_sanitize_mm_username(raw, expected):
    out = _sanitize_mm_username(raw)
    if expected is None:
        assert out.startswith("user-")
    else:
        assert out == expected


def _req(headers):
    return Request(
        {"type": "http", "headers": [(k.lower().encode(), v.encode()) for k, v in headers]}
    )


def test_invite_redirect_uri_allowed():
    req = _req([("host", "localhost:3000")])
    assert _invite_redirect_uri(req) == "http://localhost/login"


def test_invite_redirect_uri_forwarded_proto():
    req = _req([("host", "localhost:3000"), ("x-forwarded-proto", "https")])
    assert _invite_redirect_uri(req) == "https://localhost/login"


def test_invite_redirect_uri_evil_host_fallback():
    req = _req([("host", "evil.com"), ("x-forwarded-host", "evil.com, other")])
    out = _invite_redirect_uri(req)
    assert "evil.com" not in out and out.endswith("/login")


def test_invite_request_validation():
    with pytest.raises(Exception):
        InviteUserRequest(email="not-an-email", full_name="A")
    ok = InviteUserRequest(email="Test@Example.COM", full_name="A B")
    assert ok.email == "test@example.com"


# ─── list_users ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_users_success(client_overrides):
    ent = _user_entity()
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as repo_cls:
        repo_cls.return_value.list_by_tenant = AsyncMock(return_value=[ent])
        async with _client() as c:
            resp = await c.get("/api/v1/users", headers={"Authorization": "Bearer x"})
    assert resp.status_code == 200
    assert resp.json()[0]["email"] == "nv@example.com"


# ─── invite ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_invite_invalid_email_422(client_overrides):
    async with _client() as c:
        resp = await c.post(
            "/api/v1/users/invite",
            json={"email": "bad-email", "full_name": "A"},
            headers={"Authorization": "Bearer x"},
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invite_tenant_missing_500(client_overrides):
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyTenantRepository"
    ) as tenant_cls, patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ):
        tenant_cls.return_value.get_by_id = AsyncMock(return_value=None)
        async with _client() as c:
            resp = await c.post(
                "/api/v1/users/invite",
                json={"email": "a@example.com", "full_name": "A B"},
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 500


@pytest.mark.asyncio
async def test_invite_duplicate_409(client_overrides):
    client_overrides.kc.create_user.side_effect = ValueError("exists")
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyTenantRepository"
    ) as tenant_cls, patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ):
        tenant_cls.return_value.get_by_id = AsyncMock(
            return_value=SimpleNamespace(slug="acme")
        )
        async with _client() as c:
            resp = await c.post(
                "/api/v1/users/invite",
                json={"email": "a@example.com", "full_name": "A B"},
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_invite_success(client_overrides):
    new_kc = str(uuid.uuid4())
    client_overrides.kc.create_user.return_value = new_kc
    client_overrides.kc.get_group_by_name.return_value = None
    ent = _user_entity(keycloak_id=uuid.UUID(new_kc))
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyTenantRepository"
    ) as tenant_cls, patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls, patch(
        "app.entrypoints.routers.users.ensure_tenant_mattermost_team",
        new=AsyncMock(return_value={"team_id": "t1"}),
    ):
        tenant_cls.return_value.get_by_id = AsyncMock(
            return_value=SimpleNamespace(slug="acme")
        )
        user_cls.return_value.upsert = AsyncMock(return_value=ent)
        async with _client() as c:
            resp = await c.post(
                "/api/v1/users/invite",
                json={"email": "nv@example.com", "full_name": "Nhan Vien"},
                headers={"Authorization": "Bearer x", "host": "localhost:3000"},
            )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email_sent"] is True and body["email_warning"] is None


@pytest.mark.asyncio
async def test_invite_email_smtp_fail_warns(client_overrides):
    new_kc = str(uuid.uuid4())
    client_overrides.kc.create_user.return_value = new_kc
    client_overrides.kc.get_group_by_name.return_value = "g1"
    client_overrides.kc.send_invite_email.side_effect = RuntimeError("SMTP down")
    ent = _user_entity(keycloak_id=uuid.UUID(new_kc))
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyTenantRepository"
    ) as tenant_cls, patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls, patch(
        "app.entrypoints.routers.users.ensure_tenant_mattermost_team",
        new=AsyncMock(side_effect=RuntimeError("mm down")),
    ):
        tenant_cls.return_value.get_by_id = AsyncMock(
            return_value=SimpleNamespace(slug="acme")
        )
        user_cls.return_value.upsert = AsyncMock(return_value=ent)
        async with _client() as c:
            resp = await c.post(
                "/api/v1/users/invite",
                json={"email": "nv@example.com", "full_name": "Nhan Vien"},
                headers={"Authorization": "Bearer x", "host": "localhost:3000"},
            )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email_sent"] is False
    assert "SMTP" in (body["email_warning"] or "")


@pytest.mark.asyncio
async def test_invite_keycloak_aux_failures_swallowed(client_overrides):
    """set_user_attributes/assign_role/group-map lỗi vẫn invite được."""
    new_kc = str(uuid.uuid4())
    client_overrides.kc.create_user.return_value = new_kc
    client_overrides.kc.set_user_attributes.side_effect = RuntimeError("kc")
    client_overrides.kc.assign_role_to_user.side_effect = RuntimeError("kc")
    client_overrides.kc.get_group_by_name.side_effect = RuntimeError("kc")
    client_overrides.kc.send_invite_email.side_effect = ValueError("generic mail bug")
    ent = _user_entity(keycloak_id=uuid.UUID(new_kc))
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyTenantRepository"
    ) as tenant_cls, patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls, patch(
        "app.entrypoints.routers.users.ensure_tenant_mattermost_team",
        new=AsyncMock(return_value={"team_id": "t1"}),
    ):
        tenant_cls.return_value.get_by_id = AsyncMock(
            return_value=SimpleNamespace(slug="acme")
        )
        user_cls.return_value.upsert = AsyncMock(return_value=ent)
        async with _client() as c:
            resp = await c.post(
                "/api/v1/users/invite",
                json={"email": "nv@example.com", "full_name": "Single"},
                headers={"Authorization": "Bearer x", "host": "localhost:3000"},
            )
    assert resp.status_code == 201
    assert resp.json()["email_sent"] is False


# ─── resend_invite ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resend_404(client_overrides):
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=None)
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/users/{uuid.uuid4()}/resend-invite",
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_resend_wrong_tenant_404(client_overrides):
    ent = _user_entity(tenant_id=uuid.uuid4())
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=ent)
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/users/{ent.id}/resend-invite",
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_resend_already_active_400(client_overrides):
    import datetime

    ent = _user_entity(last_login_at=datetime.datetime(2026, 1, 1))
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=ent)
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/users/{ent.id}/resend-invite",
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_resend_success_and_smtp_fail(client_overrides):
    ent = _user_entity()
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=ent)
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/users/{ent.id}/resend-invite",
                headers={"Authorization": "Bearer x", "host": "localhost:3000"},
            )
    assert resp.status_code == 200
    assert resp.json()["email_sent"] is True
    # SMTP fail path
    client_overrides.kc.send_invite_email.side_effect = RuntimeError("SMTP down")
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=ent)
        async with _client() as c:
            resp = await c.post(
                f"/api/v1/users/{ent.id}/resend-invite",
                headers={"Authorization": "Bearer x", "host": "localhost:3000"},
            )
    assert resp.json()["email_sent"] is False


# ─── deactivate ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_deactivate_404(client_overrides):
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=None)
        async with _client() as c:
            resp = await c.patch(
                f"/api/v1/users/{uuid.uuid4()}/deactivate",
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_deactivate_self_400(client_overrides):
    ent = _user_entity(keycloak_id=USER_ID)
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=ent)
        async with _client() as c:
            resp = await c.patch(
                f"/api/v1/users/{ent.id}/deactivate",
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_deactivate_success_kc_fail_swallowed(client_overrides):
    ent = _user_entity()
    client_overrides.kc.disable_user.side_effect = RuntimeError("kc down")
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=ent)
        user_cls.return_value.deactivate = AsyncMock(return_value=None)
        async with _client() as c:
            resp = await c.patch(
                f"/api/v1/users/{ent.id}/deactivate",
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_deactivate_repo_notfound_404(client_overrides):
    ent = _user_entity()
    with patch(
        "app.entrypoints.routers.users.SQLAlchemyUserRepository"
    ) as user_cls:
        user_cls.return_value.get = AsyncMock(return_value=ent)
        user_cls.return_value.deactivate = AsyncMock(
            side_effect=NotFoundError("gone")
        )
        async with _client() as c:
            resp = await c.patch(
                f"/api/v1/users/{ent.id}/deactivate",
                headers={"Authorization": "Bearer x"},
            )
    assert resp.status_code == 404

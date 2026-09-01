# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import hashlib
import hmac

import pytest
from httpx import AsyncClient

from app.entrypoints.dependencies import (
    get_ai_command_use_case,
    get_audit_log_repo,
    get_db_transactional,
)
from app.infrastructure.config import settings
from main import app


@pytest.fixture
def override_mattermost_secret(monkeypatch):
    monkeypatch.setattr(settings, "MATTERMOST_WEBHOOK_SECRET", "test-secret")


@pytest.fixture
def mock_mattermost_payload():
    return {
        "user_id": "usr_123",
        "context": {"action_id": "12345678-1234-5678-1234-567812345678", "action": "approve", "foo": "bar"},
    }


def generate_signature(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


@pytest.fixture(autouse=True)
def override_webhook_dependencies():
    class MockAICommandUseCase:
        def __init__(self):
            from unittest.mock import AsyncMock
            self.ai_command_repo = AsyncMock()
            self.ai_command_repo.get_command_by_id.return_value = {"tenant_id": "12345678-1234-5678-1234-567812345678"}

        async def process_approval(self, cmd_id, approver_id, action_taken):
            return True

    class MockAuditLogRepo:
        async def insert_log(self, *args, **kwargs):
            pass

    class MockSession:
        async def commit(self):
            pass

    app.dependency_overrides[get_ai_command_use_case] = lambda: MockAICommandUseCase()
    app.dependency_overrides[get_audit_log_repo] = lambda: MockAuditLogRepo()
    app.dependency_overrides[get_db_transactional] = lambda: MockSession()
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_mattermost_webhook_approve_success(
    override_mattermost_secret, mock_mattermost_payload
):
    import json

    body = json.dumps(mock_mattermost_payload).encode("utf-8")
    signature = generate_signature("test-secret", body)

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/webhooks/mattermost/callback",
            content=body,
            headers={"Mattermost-Signature": signature},
        )

    assert response.status_code == 200
    assert "phê duyệt" in response.json()["ephemeral_text"]


@pytest.mark.asyncio
async def test_mattermost_webhook_reject_success(
    override_mattermost_secret, mock_mattermost_payload
):
    import json

    mock_mattermost_payload["context"]["action"] = "reject"
    body = json.dumps(mock_mattermost_payload).encode("utf-8")
    signature = generate_signature("test-secret", body)

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/webhooks/mattermost/callback",
            content=body,
            headers={"Mattermost-Signature": signature},
        )

    assert response.status_code == 200
    assert "từ chối" in response.json()["ephemeral_text"]


@pytest.mark.asyncio
async def test_mattermost_webhook_invalid_signature(
    override_mattermost_secret, mock_mattermost_payload
):
    import json

    body = json.dumps(mock_mattermost_payload).encode("utf-8")
    signature = "invalid_signature"

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/webhooks/mattermost/callback",
            content=body,
            headers={"Mattermost-Signature": signature},
        )

    assert response.status_code == 400
    assert "Chữ ký HMAC không hợp lệ" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mattermost_webhook_missing_signature(
    override_mattermost_secret, mock_mattermost_payload
):
    import json

    body = json.dumps(mock_mattermost_payload).encode("utf-8")

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/webhooks/mattermost/callback", content=body
        )

    assert response.status_code == 400
    assert "Chữ ký HMAC không hợp lệ" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mattermost_webhook_invalid_action(
    override_mattermost_secret, mock_mattermost_payload
):
    import json

    mock_mattermost_payload["context"]["action"] = "invalid_action"
    body = json.dumps(mock_mattermost_payload).encode("utf-8")
    signature = generate_signature("test-secret", body)

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/webhooks/mattermost/callback",
            content=body,
            headers={"Mattermost-Signature": signature},
        )

    assert response.status_code == 400
    assert "Action không hợp lệ" in response.json()["detail"]

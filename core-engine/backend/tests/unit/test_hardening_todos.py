# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

from app.core.use_cases.plugin_upgrade import _DANGEROUS_SQL, _strip_sql_comments
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.external.n8n_adapter import N8nAdapter, N8nAdapterError


def test_upgrade_dangerous_sql_denylist_blocks_risky_ddl():
    dangerous_statements = [
        "DROP TABLE users;",
        "DROP COLUMN email;",
        "DROP FUNCTION calc_salary();",
        "DROP PROCEDURE do_something();",
        "DROP INDEX idx_users_email;",
        "DROP VIEW user_summary;",
        "DROP TRIGGER on_insert ON users;",
        "DROP POLICY p1 ON users;",
        "DROP SCHEMA public;",
        "DROP DATABASE proteus;",
        "TRUNCATE TABLE users;",
        "ALTER TABLE users DROP COLUMN name;",
        "GRANT ALL PRIVILEGES ON DATABASE proteus TO hacker;",
        "REVOKE ALL ON users FROM app_user;",
        "CREATE FUNCTION test() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql SECURITY DEFINER;",
        "SELECT * FROM public.users;",
        "SELECT * FROM pg_catalog.pg_tables;",
        "SELECT * FROM information_schema.tables;",
    ]

    for stmt in dangerous_statements:
        safe_stmt = _strip_sql_comments(stmt)
        assert _DANGEROUS_SQL.search(safe_stmt) is not None, f"Dangerous SQL not blocked: {stmt}"


def test_upgrade_dangerous_sql_denylist_allows_safe_ddl():
    safe_statements = [
        "ALTER TABLE hr_employees ADD COLUMN emergency_contact VARCHAR(255);",
        "CREATE TABLE IF NOT EXISTS hr_payroll_config (id UUID PRIMARY KEY, tenant_id UUID NOT NULL);",
        "CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON hr_employees(status);",
        "INSERT INTO hr_payroll_config (id, tenant_id) VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');",
    ]

    for stmt in safe_statements:
        safe_stmt = _strip_sql_comments(stmt)
        assert _DANGEROUS_SQL.search(safe_stmt) is None, f"Safe SQL incorrectly blocked: {stmt}"


@pytest.mark.asyncio
async def test_mattermost_adapter_update_message():
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.raise_for_status = MagicMock()
    mock_client.request.return_value = mock_response

    adapter = MattermostAdapter(client=mock_client)
    adapter.token = "test-token"
    adapter.headers["Authorization"] = "Bearer test-token"

    await adapter.update_message("post123", "updated content", {"custom": "prop"})

    mock_client.request.assert_called_once()
    args, kwargs = mock_client.request.call_args
    assert args[0] == "PUT"
    assert "/api/v4/posts/post123" in args[1]
    assert kwargs["json"] == {"id": "post123", "message": "updated content", "props": {"custom": "prop"}}


@pytest.mark.asyncio
async def test_n8n_adapter_delete_credential():
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_client.request.return_value = mock_response

    adapter = N8nAdapter(client=mock_client)
    adapter.api_key = "test-key"

    await adapter.delete_credential("cred123")

    mock_client.request.assert_called_once()
    args, kwargs = mock_client.request.call_args
    assert args[0] == "DELETE"
    assert "credentials/cred123" in args[1]


@pytest.mark.asyncio
async def test_n8n_adapter_delete_credential_idempotent_404():
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 404
    mock_client.request.return_value = mock_response

    adapter = N8nAdapter(client=mock_client)
    adapter.api_key = "test-key"

    # Should not raise exception on 404
    await adapter.delete_credential("cred_missing")

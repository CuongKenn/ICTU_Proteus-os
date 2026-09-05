# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from app.adapters.external.appsmith_adapter import (
    AppsmithAdapter,
    AppsmithAdapterError,
    AppsmithAppNotFoundError,
)
from app.core.domain.exceptions import PathConflictError

@pytest.fixture
def mock_client():
    return AsyncMock(spec=httpx.AsyncClient)

@pytest.fixture
def adapter(mock_client):
    with patch("app.adapters.external.appsmith_adapter.settings") as mock_settings:
        mock_settings.APPSMITH_URL = "http://appsmith.local"
        mock_settings.APPSMITH_API_KEY = "test_key"
        yield AppsmithAdapter(client=mock_client)

@pytest.mark.asyncio
async def test_import_app_success(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(
        200, json={"data": {"id": "app-123", "name": "HR App"}}
    )
    app_id = await adapter.import_app({"name": "HR App"})
    assert app_id == "app-123"
    mock_client.request.assert_called_once()

@pytest.mark.asyncio
async def test_import_app_failure(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(400, text="Bad Request")
    
    with pytest.raises(AppsmithAdapterError, match="HTTP 400"):
        await adapter.import_app({"name": "HR App"})

@pytest.mark.asyncio
async def test_delete_app_success(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(204)
    await adapter.delete_app("app-123")
    mock_client.request.assert_called_once()

@pytest.mark.asyncio
async def test_delete_app_not_found(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(404)
    await adapter.delete_app("app-123")
    mock_client.request.assert_called_once()

@pytest.mark.asyncio
async def test_check_path_conflict_system_path(adapter):
    with pytest.raises(PathConflictError, match="conflicts with system path"):
        await adapter.check_path_conflict("/auth", "tenant-123")

@pytest.mark.asyncio
async def test_check_path_conflict_invalid_prefix(adapter):
    with pytest.raises(PathConflictError, match="must start with '/apps/'"):
        await adapter.check_path_conflict("/dashboard/hr", "tenant-123")

@pytest.mark.asyncio
async def test_check_path_conflict_true(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(
        200, json={"data": [{"slug": "hr"}, {"slug": "finance"}]}
    )
    is_conflict = await adapter.check_path_conflict("/apps/hr", "tenant-123")
    assert is_conflict is True

@pytest.mark.asyncio
async def test_check_path_conflict_false(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(
        200, json={"data": [{"slug": "finance"}]}
    )
    is_conflict = await adapter.check_path_conflict("/apps/hr", "tenant-123")
    assert is_conflict is False

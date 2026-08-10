# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.adapters.external.appsmith_adapter import AppsmithAdapter, AppsmithAdapterError
from app.core.domain.exceptions import PathConflictError


@pytest.fixture
def adapter():
    return AppsmithAdapter()


@pytest.mark.asyncio
async def test_appsmith_adapter_import_app_success(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"id": "app_123"}}
        mock_req.return_value = mock_response

        app_id = await adapter.import_app(json_data={"name": "demo_app"})
        assert app_id == "app_123"


@pytest.mark.asyncio
async def test_appsmith_adapter_import_app_system_path_conflict(adapter):
    with pytest.raises(PathConflictError) as exc_info:
        await adapter.check_path_conflict(path="/api", tenant_id="tenant-1")
    assert "conflict" in str(exc_info.value)


@pytest.mark.asyncio
async def test_appsmith_adapter_delete_app_success(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_req.return_value = mock_response

        result = await adapter.delete_app("app_123")
        assert result is None


from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.adapters.external.appsmith_adapter import AppsmithAdapterError
from app.core.domain.exceptions import PathConflictError


@pytest.mark.asyncio
async def test_appsmith_adapter_import_app_retry_success(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response_500 = MagicMock()
        mock_response_500.status_code = 500

        mock_response_200 = MagicMock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {"data": {"id": "app_123"}}

        mock_req.side_effect = [mock_response_500, mock_response_200]

        app_id = await adapter.import_app({"name": "demo"})
        assert app_id == "app_123"
        assert mock_req.call_count == 2


@pytest.mark.asyncio
async def test_appsmith_adapter_import_app_missing_id(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {}}
        mock_req.return_value = mock_response

        with pytest.raises(AppsmithAdapterError) as exc_info:
            await adapter.import_app({"name": "demo"})
        assert "missing 'id'" in str(exc_info.value)


@pytest.mark.asyncio
async def test_appsmith_adapter_import_app_4xx_failure(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad Request"
        mock_req.return_value = mock_response

        with pytest.raises(AppsmithAdapterError) as exc_info:
            await adapter.import_app({"name": "demo"})
        assert "HTTP 400" in str(exc_info.value)


@pytest.mark.asyncio
async def test_appsmith_adapter_delete_app_404(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_req.return_value = mock_response

        # Should not raise
        await adapter.delete_app("app_123")


@pytest.mark.asyncio
async def test_appsmith_adapter_delete_app_failure(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Error"
        mock_req.return_value = mock_response

        with pytest.raises(AppsmithAdapterError):
            await adapter.delete_app("app_123")


@pytest.mark.asyncio
async def test_appsmith_adapter_check_path_conflict_no_prefix(adapter):
    with pytest.raises(PathConflictError) as exc_info:
        await adapter.check_path_conflict("/wrongprefix/demo", "t1")
    assert "must start with '/apps/'" in str(exc_info.value)


@pytest.mark.asyncio
async def test_appsmith_adapter_check_path_conflict_found(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"slug": "demo"}]
        mock_req.return_value = mock_response

        conflict = await adapter.check_path_conflict("/apps/demo", "t1")
        assert conflict is True


@pytest.mark.asyncio
async def test_appsmith_adapter_check_path_conflict_http_error(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 500
        # Wait, the code has retry for 500. So we mock 3 times
        mock_req.side_effect = [mock_response, mock_response, mock_response]

        # In check_path_conflict, an AppsmithAdapterError is caught and returns False
        conflict = await adapter.check_path_conflict("/apps/demo", "t1")
        assert conflict is False

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
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

        app_id = await adapter.import_app(
            json_data={"name": "demo_app"}
        )
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


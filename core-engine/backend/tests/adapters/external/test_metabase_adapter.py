import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.adapters.external.metabase_adapter import MetabaseAdapter, MetabaseAdapterError

@pytest.fixture
def adapter():
    return MetabaseAdapter()

@pytest.mark.asyncio
async def test_metabase_adapter_create_dashboard_success(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": 123}
        mock_req.return_value = mock_response

        dash_id = await adapter.create_dashboard(
            config={"name": "Test Dashboard"}
        )
        assert dash_id == "123"

@pytest.mark.asyncio
async def test_metabase_adapter_create_dashboard_failure(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad request"
        mock_req.return_value = mock_response

        with pytest.raises(MetabaseAdapterError):
            await adapter.create_dashboard(
                config={"name": "Test Dashboard"}
            )

@pytest.mark.asyncio
async def test_metabase_adapter_delete_dashboard_success(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_req.return_value = mock_response

        result = await adapter.delete_dashboard("123")
        assert result is None


def test_metabase_adapter_get_embed_url(adapter):
    url = adapter.get_embed_url(
        dashboard_id="123",
        tenant_id="tenant-1",
        ttl=60
    )
    assert "embed/dashboard/" in url
    assert "bordered=true&titled=true" in url

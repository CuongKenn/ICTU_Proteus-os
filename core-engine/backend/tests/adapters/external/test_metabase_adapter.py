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

        dash_id = await adapter.create_dashboard(config={"name": "Test Dashboard"})
        assert dash_id == "123"


@pytest.mark.asyncio
async def test_metabase_adapter_create_dashboard_failure(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad request"
        mock_req.return_value = mock_response

        with pytest.raises(MetabaseAdapterError):
            await adapter.create_dashboard(config={"name": "Test Dashboard"})


@pytest.mark.asyncio
async def test_metabase_adapter_delete_dashboard_success(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_req.return_value = mock_response

        result = await adapter.delete_dashboard("123")
        assert result is None


def test_metabase_adapter_get_embed_url(adapter):
    url = adapter.get_embed_url(dashboard_id="123", tenant_id="tenant-1", ttl=60)
    assert "embed/dashboard/" in url
    assert "bordered=true&titled=true" in url


@pytest.mark.asyncio
async def test_metabase_adapter_create_dashboard_retry_success(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response_500 = MagicMock()
        mock_response_500.status_code = 500
        mock_response_200 = MagicMock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {"id": 123}
        mock_req.side_effect = [mock_response_500, mock_response_200]
        dash_id = await adapter.create_dashboard({"name": "Test"})
        assert dash_id == "123"
        assert mock_req.call_count == 2


@pytest.mark.asyncio
async def test_metabase_adapter_create_dashboard_transport_error(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        import httpx

        mock_req.side_effect = httpx.TransportError("Network error")
        with pytest.raises(MetabaseAdapterError):
            await adapter.create_dashboard({"name": "Test"})


@pytest.mark.asyncio
async def test_metabase_adapter_create_dashboard_missing_id(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        mock_req.return_value = mock_response
        with pytest.raises(MetabaseAdapterError) as exc_info:
            await adapter.create_dashboard({"name": "Test"})
        assert "missing 'id'" in str(exc_info.value)


@pytest.mark.asyncio
async def test_metabase_adapter_delete_dashboard_404(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_req.return_value = mock_response
        await adapter.delete_dashboard("123")


@pytest.mark.asyncio
async def test_metabase_adapter_delete_dashboard_failure(adapter):
    with patch("httpx.AsyncClient.request", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_req.return_value = mock_response
        with pytest.raises(MetabaseAdapterError):
            await adapter.delete_dashboard("123")

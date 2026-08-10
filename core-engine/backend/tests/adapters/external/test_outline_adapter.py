from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import HTTPError, Response

from app.adapters.external.outline_adapter import OutlineAdapter, OutlineAdapterError
from app.infrastructure.config import settings


@pytest.fixture
def mock_httpx_client():
    with patch(
        "app.adapters.external.outline_adapter.httpx.AsyncClient"
    ) as mock_client_class:
        mock_instance = mock_client_class.return_value.__aenter__.return_value
        yield mock_instance


@pytest.mark.asyncio
async def test_outline_list_documents_success(mock_httpx_client, monkeypatch):
    monkeypatch.setattr(settings, "OUTLINE_API_KEY", "test-token")

    adapter = OutlineAdapter()

    mock_response = MagicMock(spec=Response)
    mock_response.json.return_value = {"data": [{"id": "1", "title": "Doc 1"}]}
    mock_httpx_client.post.return_value = mock_response

    result = await adapter.list_documents()

    assert len(result) == 1
    assert result[0]["title"] == "Doc 1"

    mock_httpx_client.post.assert_called_once()
    kwargs = mock_httpx_client.post.call_args.kwargs
    assert kwargs["json"]["offset"] == 0
    assert kwargs["json"]["limit"] == 100
    assert kwargs["headers"]["Authorization"] == "Bearer test-token"


@pytest.mark.asyncio
async def test_outline_list_documents_no_api_key(monkeypatch):
    monkeypatch.setattr(settings, "OUTLINE_API_KEY", "")

    adapter = OutlineAdapter()
    result = await adapter.list_documents()

    assert result == []


@pytest.mark.asyncio
async def test_outline_list_documents_error(mock_httpx_client, monkeypatch):
    monkeypatch.setattr(settings, "OUTLINE_API_KEY", "test-token")

    adapter = OutlineAdapter()
    mock_httpx_client.post.side_effect = HTTPError("Network error")

    with pytest.raises(
        OutlineAdapterError, match="Failed to fetch documents: Network error"
    ):
        await adapter.list_documents()

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.adapters.external.outline_adapter import OutlineAdapter, OutlineAdapterError


@pytest.fixture
def adapter():
    with patch("app.adapters.external.outline_adapter.settings") as mock_settings:
        mock_settings.OUTLINE_URL = "http://outline.local"
        mock_settings.OUTLINE_API_KEY = "test-key"
        yield OutlineAdapter()


@pytest.mark.asyncio
async def test_list_documents_success(adapter):
    mock_response = httpx.Response(
        200,
        json={"data": [{"id": "doc1", "urlId": "url1"}]},
        request=httpx.Request("POST", "http://test"),
    )

    mock_client_instance = AsyncMock()
    mock_client_instance.post.return_value = mock_response
    mock_client_instance.__aenter__.return_value = mock_client_instance

    with patch(
        "app.adapters.external.outline_adapter.httpx.AsyncClient",
        return_value=mock_client_instance,
    ):
        docs = await adapter.list_documents(collection_id="coll1")

        assert len(docs) == 1
        assert docs[0]["id"] == "doc1"
        assert docs[0]["source_url"] == "http://outline.local/doc/url1"
        mock_client_instance.post.assert_called_once()


@pytest.mark.asyncio
async def test_list_documents_no_api_key(adapter):
    adapter.api_key = None
    docs = await adapter.list_documents()
    assert docs == []


@pytest.mark.asyncio
async def test_list_documents_http_error(adapter):
    mock_response = httpx.Response(500, request=httpx.Request("POST", "http://test"))

    mock_client_instance = AsyncMock()
    mock_client_instance.post.side_effect = httpx.HTTPStatusError(
        "Error", request=mock_response.request, response=mock_response
    )
    mock_client_instance.__aenter__.return_value = mock_client_instance

    with patch(
        "app.adapters.external.outline_adapter.httpx.AsyncClient",
        return_value=mock_client_instance,
    ):
        with pytest.raises(OutlineAdapterError, match="Failed to fetch documents:"):
            await adapter.list_documents()

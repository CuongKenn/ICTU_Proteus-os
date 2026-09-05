# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.adapters.external.metabase_adapter import MetabaseAdapter, MetabaseAdapterError


@pytest.fixture
def mock_client():
    return AsyncMock(spec=httpx.AsyncClient)


@pytest.fixture
def adapter(mock_client):
    with patch("app.adapters.external.metabase_adapter.settings") as mock_settings:
        mock_settings.METABASE_SITE_URL = "http://metabase.local"
        mock_settings.METABASE_EMBEDDING_KEY = "supersecretkey"
        yield MetabaseAdapter(client=mock_client)


@pytest.mark.asyncio
async def test_create_dashboard_success(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(
        200, json={"id": 42, "name": "HR Dashboard"}
    )
    dashboard_id = await adapter.create_dashboard({"name": "HR Dashboard"})

    assert dashboard_id == "42"
    mock_client.request.assert_called_once()


@pytest.mark.asyncio
async def test_create_dashboard_failure(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(400, text="Bad Request")

    with pytest.raises(MetabaseAdapterError, match="HTTP 400"):
        await adapter.create_dashboard({"name": "HR Dashboard"})


@pytest.mark.asyncio
async def test_delete_dashboard_success(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(204)
    await adapter.delete_dashboard("42")
    mock_client.request.assert_called_once()


@pytest.mark.asyncio
async def test_delete_dashboard_not_found(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(404)
    await adapter.delete_dashboard("42")
    # Idempotent, should not raise
    mock_client.request.assert_called_once()


def test_get_embed_url(adapter):
    adapter._embedding_key = "supersecret"
    url = adapter.get_embed_url("42", "tenant-123", ttl=3600)

    assert "http://metabase.local/embed/dashboard/" in url
    assert "#bordered=true&titled=true" in url

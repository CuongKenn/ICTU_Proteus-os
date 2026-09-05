# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from qdrant_client.models import Filter

from app.adapters.external.qdrant_adapter import QdrantAdapter, QdrantAdapterError


@pytest.fixture
def mock_client():
    client = AsyncMock()
    return client


@pytest.fixture
def adapter(mock_client):
    with patch("app.adapters.external.qdrant_adapter.settings") as mock_settings:
        mock_settings.QDRANT_URL = "http://qdrant.local"
        yield QdrantAdapter(qdrant_client=mock_client)


@pytest.mark.asyncio
async def test_ensure_collection_exists(adapter, mock_client):
    mock_client.collection_exists.return_value = False

    await adapter._ensure_collection_exists()

    mock_client.collection_exists.assert_called_once_with("knowledge_base")
    mock_client.recreate_collection.assert_called_once()
    assert adapter._collection_ensured is True

    # Second call should return immediately
    await adapter._ensure_collection_exists()
    assert mock_client.collection_exists.call_count == 1


@pytest.mark.asyncio
async def test_upsert_vectors_success(adapter, mock_client):
    adapter._collection_ensured = True  # Skip ensure check

    await adapter.upsert_vectors("tenant-1", ["doc1"], [{"meta": "data"}])

    mock_client.add.assert_called_once_with(
        collection_name="knowledge_base",
        documents=["doc1"],
        metadata=[{"meta": "data", "tenant_id": "tenant-1"}],
    )


@pytest.mark.asyncio
async def test_upsert_vectors_error(adapter, mock_client):
    adapter._collection_ensured = True
    mock_client.add.side_effect = Exception("DB down")

    with pytest.raises(QdrantAdapterError, match="Upsert failed: DB down"):
        await adapter.upsert_vectors("tenant-1", ["doc1"], [{"meta": "data"}])


@pytest.mark.asyncio
async def test_search_success(adapter, mock_client):
    adapter._collection_ensured = True

    # Setup mock hit
    hit1 = MagicMock()
    hit1.id = "id1"
    hit1.score = 0.95
    hit1.document = "doc1"
    hit1.metadata = {"tenant_id": "tenant-1"}

    mock_client.query.return_value = [hit1]

    results = await adapter.search(
        "tenant-1", "test query", limit=1, filters={"type": "pdf"}
    )

    assert len(results) == 1
    assert results[0]["id"] == "id1"
    assert results[0]["document"] == "doc1"

    mock_client.query.assert_called_once()
    call_kwargs = mock_client.query.call_args[1]

    assert call_kwargs["collection_name"] == "knowledge_base"
    assert call_kwargs["query_text"] == "test query"

    # Verify filter
    query_filter = call_kwargs["query_filter"]
    assert isinstance(query_filter, Filter)
    assert len(query_filter.must) == 2
    assert query_filter.must[0].key == "tenant_id"
    assert query_filter.must[0].match.value == "tenant-1"


@pytest.mark.asyncio
async def test_delete_by_tenant_success(adapter, mock_client):
    adapter._collection_ensured = True

    result = await adapter.delete_by_tenant("tenant-1")

    assert result is True
    mock_client.delete.assert_called_once()
    call_kwargs = mock_client.delete.call_args[1]
    assert call_kwargs["collection_name"] == "knowledge_base"

    points_selector = call_kwargs["points_selector"]
    assert isinstance(points_selector, Filter)
    assert points_selector.must[0].key == "tenant_id"
    assert points_selector.must[0].match.value == "tenant-1"

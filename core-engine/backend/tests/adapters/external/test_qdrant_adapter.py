# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.adapters.external.qdrant_adapter import QdrantAdapter, QdrantAdapterError


@pytest.fixture
def mock_qdrant_client():
    with patch(
        "app.adapters.external.qdrant_adapter.AsyncQdrantClient"
    ) as mock_client_class:
        mock_instance = mock_client_class.return_value
        mock_instance.collection_exists = AsyncMock(return_value=True)
        mock_instance.add = AsyncMock()
        mock_instance.query = AsyncMock()
        mock_instance.delete = AsyncMock()

        # Mock results for query
        mock_hit = MagicMock()
        mock_hit.id = "123"
        mock_hit.score = 0.95
        mock_hit.document = "Document content"
        mock_hit.metadata = {"tenant_id": "tenant-1"}
        mock_instance.query.return_value = [mock_hit]

        yield mock_instance


@pytest.mark.asyncio
async def test_upsert_vectors(mock_qdrant_client):
    adapter = QdrantAdapter()

    chunks = ["chunk1", "chunk2"]
    metadatas = [{"source": "file1"}, {"source": "file2"}]

    result = await adapter.upsert_vectors("tenant-1", chunks, metadatas)

    assert result is True
    # Ensure tenant_id was injected
    assert metadatas[0]["tenant_id"] == "tenant-1"

    mock_qdrant_client.add.assert_called_once()
    kwargs = mock_qdrant_client.add.call_args.kwargs
    assert kwargs["collection_name"] == "knowledge_base"
    assert kwargs["documents"] == chunks
    assert kwargs["metadata"] == metadatas


@pytest.mark.asyncio
async def test_hybrid_search(mock_qdrant_client):
    adapter = QdrantAdapter()

    results = await adapter.hybrid_search("tenant-1", "test query", top_k=3)

    assert len(results) == 1
    assert results[0]["document"] == "Document content"
    assert results[0]["metadata"]["tenant_id"] == "tenant-1"

    mock_qdrant_client.query.assert_called_once()
    kwargs = mock_qdrant_client.query.call_args.kwargs
    assert kwargs["query_text"] == "test query"
    assert kwargs["limit"] == 3

    # Check if filter contains the correct tenant_id
    query_filter = kwargs["query_filter"]
    assert query_filter.must[0].key == "tenant_id"
    assert query_filter.must[0].match.value == "tenant-1"


@pytest.mark.asyncio
async def test_delete_by_tenant(mock_qdrant_client):
    adapter = QdrantAdapter()

    result = await adapter.delete_by_tenant("tenant-1")

    assert result is True
    mock_qdrant_client.delete.assert_called_once()
    kwargs = mock_qdrant_client.delete.call_args.kwargs

    points_selector = kwargs["points_selector"]
    assert points_selector.must[0].key == "tenant_id"
    assert points_selector.must[0].match.value == "tenant-1"


@pytest.mark.asyncio
async def test_qdrant_error_handling(mock_qdrant_client):
    mock_qdrant_client.add.side_effect = Exception("Connection error")

    adapter = QdrantAdapter()

    with pytest.raises(QdrantAdapterError, match="Upsert failed: Connection error"):
        await adapter.upsert_vectors("tenant-1", ["chunk"], [{}])

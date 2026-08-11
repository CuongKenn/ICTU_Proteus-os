# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.use_cases.rag_ingestion import RAGIngestionUseCase


@pytest.fixture
def mock_adapters():
    outline_adapter = MagicMock()
    outline_adapter.base_url = "http://outline.local"
    outline_adapter.list_documents = AsyncMock()

    qdrant_adapter = MagicMock()
    qdrant_adapter.upsert_vectors = AsyncMock(return_value=True)

    return outline_adapter, qdrant_adapter


@pytest.mark.asyncio
async def test_rag_ingestion_success(mock_adapters):
    outline_adapter, qdrant_adapter = mock_adapters

    # Mock documents
    mock_docs = [
        {
            "id": "doc1",
            "title": "First Doc",
            "urlId": "first-doc-xyz",
            "source_url": "http://outline.local/doc/first-doc-xyz",
            "text": "This is paragraph 1.\n\nThis is paragraph 2.",
        },
        {
            "id": "doc2",
            "title": "Second Doc",
            "urlId": "second-doc-abc",
            "source_url": "http://outline.local/doc/second-doc-abc",
            "text": "Short text.",
        },
    ]
    outline_adapter.list_documents.return_value = mock_docs

    use_case = RAGIngestionUseCase(outline_adapter, qdrant_adapter)
    use_case.max_chars_per_chunk = (
        25  # Small enough to force splitting doc1 into 2 chunks
    )
    result = await use_case.execute("tenant-1")

    assert result["status"] == "success"
    assert result["processed_documents"] == 2
    assert result["upserted_chunks"] == 3  # 2 chunks for doc1, 1 chunk for doc2

    # Verify upsert_vectors was called twice (once for each doc with valid chunks)
    assert qdrant_adapter.upsert_vectors.call_count == 2

    # Check args for the first doc
    call_args = qdrant_adapter.upsert_vectors.call_args_list[0].kwargs
    assert call_args["tenant_id"] == "tenant-1"
    assert len(call_args["chunks"]) == 2
    assert call_args["chunks"][0] == "This is paragraph 1."
    assert call_args["metadatas"][0]["doc_title"] == "First Doc"
    assert (
        call_args["metadatas"][0]["source_url"]
        == "http://outline.local/doc/first-doc-xyz"
    )


def test_chunking_long_paragraph():
    use_case = RAGIngestionUseCase(None, None)
    use_case.max_chars_per_chunk = 50  # Small size for testing

    # Create a long text with multiple newlines
    text = "Line 1 is short.\nLine 2 is also short but together they are long.\nLine 3 is here."
    chunks = use_case._chunk_text(text)

    assert len(chunks) == 3
    assert "Line 1 is short." in chunks[0]
    assert "Line 3 is here." in chunks[2]


@pytest.mark.asyncio
async def test_rag_ingestion_error(mock_adapters):
    outline_adapter, qdrant_adapter = mock_adapters
    outline_adapter.list_documents.side_effect = Exception("Outline is down")

    use_case = RAGIngestionUseCase(outline_adapter, qdrant_adapter)
    result = await use_case.execute("tenant-1")

    assert result["status"] == "failed"
    assert "Outline is down" in result["error"]

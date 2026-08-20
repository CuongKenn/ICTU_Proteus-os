# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock

import pytest

from app.adapters.external.qdrant_adapter import QdrantAdapter
from app.adapters.external.redis_event_bus import RedisEventBusPublisher
from app.ai.kv_cache_ipc import KVCacheIPCManager


@pytest.fixture
def mock_qdrant():
    qdrant = AsyncMock(spec=QdrantAdapter)
    qdrant.upsert_vectors = AsyncMock(return_value=True)
    qdrant.search = AsyncMock(return_value=[{"document": "test context"}])
    return qdrant


@pytest.fixture
def mock_redis():
    redis = AsyncMock(spec=RedisEventBusPublisher)
    redis.publish = AsyncMock()
    return redis


@pytest.mark.asyncio
async def test_transmit_context(mock_qdrant, mock_redis):
    manager = KVCacheIPCManager(qdrant_adapter=mock_qdrant, redis_publisher=mock_redis)

    pointer_uuid, latency = await manager.transmit_context(
        tenant_id="tenant-1",
        source_agent="hr-module",
        target_agent="finance-module",
        context_text="This is a huge context text...",
    )

    assert pointer_uuid is not None
    assert latency >= 0

    mock_qdrant.upsert_vectors.assert_called_once()
    args, kwargs = mock_qdrant.upsert_vectors.call_args
    assert kwargs["tenant_id"] == "tenant-1"
    assert kwargs["chunks"] == ["This is a huge context text..."]
    assert kwargs["metadatas"][0]["source_agent"] == "hr-module"

    mock_redis.publish.assert_called_once()
    args, kwargs = mock_redis.publish.call_args
    assert kwargs["event_type"] == "ai.agent.ipc"
    assert kwargs["tenant_id"] == "tenant-1"
    assert kwargs["plugin_source"] == "hr-module"
    assert kwargs["payload"]["target_agent"] == "finance-module"
    assert kwargs["payload"]["pointer_uuid"] == str(pointer_uuid)


@pytest.mark.asyncio
async def test_retrieve_context(mock_qdrant, mock_redis):
    manager = KVCacheIPCManager(qdrant_adapter=mock_qdrant, redis_publisher=mock_redis)

    result = await manager.retrieve_context(
        tenant_id="tenant-1", pointer_uuid="1234-5678"
    )

    assert result == "test context"
    mock_qdrant.search.assert_called_once()
    args, kwargs = mock_qdrant.search.call_args
    assert kwargs["tenant_id"] == "tenant-1"
    assert kwargs["query"] == "1234-5678"
    assert kwargs["filters"] == {"pointer_uuid": "1234-5678"}

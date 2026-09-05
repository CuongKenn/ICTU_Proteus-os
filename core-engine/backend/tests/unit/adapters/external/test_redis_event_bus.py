# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.adapters.external.redis_event_bus import (
    EventBusPublishError,
    RedisEventBusPublisher,
)


@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.publish.return_value = 1
    return redis


@pytest.fixture
def adapter():
    return RedisEventBusPublisher()


@pytest.mark.asyncio
async def test_get_connection(adapter, mock_redis):
    with patch(
        "app.adapters.external.redis_event_bus.aioredis.from_url"
    ) as mock_from_url:
        mock_from_url.return_value = mock_redis

        conn = await adapter._get_connection()
        assert conn == mock_redis
        mock_from_url.assert_called_once()

        # Second call should use cached connection
        conn2 = await adapter._get_connection()
        assert conn2 == mock_redis
        mock_from_url.assert_called_once()  # still once


@pytest.mark.asyncio
async def test_publish_success(adapter, mock_redis):
    with patch(
        "app.adapters.external.redis_event_bus.aioredis.from_url"
    ) as mock_from_url:
        mock_from_url.return_value = mock_redis

        await adapter.publish(
            "hr.employee.created", "tenant-1", "hr-module", {"name": "John"}
        )

        mock_redis.publish.assert_called_once()
        call_args = mock_redis.publish.call_args[0]
        channel = call_args[0]
        message_json = call_args[1]

        assert channel == "proteus:events:hr.employee.created"

        message = json.loads(message_json)
        assert message["event_type"] == "hr.employee.created"
        assert message["tenant_id"] == "tenant-1"
        assert message["plugin_source"] == "hr-module"
        assert message["payload"]["name"] == "John"
        assert "event_id" in message
        assert "created_at" in message


@pytest.mark.asyncio
async def test_publish_failure(adapter, mock_redis):
    with patch(
        "app.adapters.external.redis_event_bus.aioredis.from_url"
    ) as mock_from_url:
        mock_redis.publish.side_effect = Exception("Redis is down")
        mock_from_url.return_value = mock_redis

        with pytest.raises(EventBusPublishError, match="Redis is down"):
            await adapter.publish("hr.employee.created", "tenant-1", "hr-module", {})


@pytest.mark.asyncio
async def test_publish_plugin_lifecycle(adapter, mock_redis):
    with patch(
        "app.adapters.external.redis_event_bus.aioredis.from_url"
    ) as mock_from_url:
        mock_from_url.return_value = mock_redis

        await adapter.publish_plugin_lifecycle(
            "installed", "tenant-1", "hr-module", "1.0.0", extra_data={"status": "ok"}
        )

        mock_redis.publish.assert_called_once()
        call_args = mock_redis.publish.call_args[0]
        assert call_args[0] == "proteus:events:plugin.installed"

        message = json.loads(call_args[1])
        assert message["payload"]["plugin_name"] == "hr-module"
        assert message["payload"]["plugin_version"] == "1.0.0"
        assert message["payload"]["status"] == "ok"

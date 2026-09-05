# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.adapters.external.redis_event_bus import RedisEventBusPublisher


@pytest.fixture
def publisher():
    return RedisEventBusPublisher()


@pytest.mark.asyncio
async def test_redis_publisher_publish_success(publisher):
    with patch(
        "app.adapters.external.redis_event_bus.aioredis.from_url"
    ) as mock_from_url:
        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock(return_value=1)
        mock_redis.xadd = AsyncMock(return_value="1620000000-0")
        mock_redis.close = AsyncMock()
        mock_from_url.return_value = mock_redis

        await publisher.publish_plugin_lifecycle(
            action="INSTALL_STARTED",
            tenant_id="tenant-1",
            plugin_name="demo",
            plugin_version="1.0.0",
        )

        assert mock_redis.xadd.call_count == 1
        call_args = mock_redis.xadd.call_args[0]
        # Check topic
        assert "proteus:events:plugin" in call_args[0]

        # Check envelope
        message_dict = call_args[1]
        event_data = json.loads(message_dict["data"])
        assert event_data["event_type"] == "plugin.INSTALL_STARTED"
        assert event_data["tenant_id"] == "tenant-1"
        assert event_data["payload"]["plugin_name"] == "demo"
        assert "event_id" in event_data
        assert "created_at" in event_data


from app.adapters.external.redis_event_bus import EventBusPublishError


@pytest.mark.asyncio
async def test_redis_publisher_aclose(publisher):
    with patch(
        "app.adapters.external.redis_event_bus.aioredis.from_url"
    ) as mock_from_url:
        mock_redis = MagicMock()
        mock_redis.aclose = AsyncMock()
        mock_from_url.return_value = mock_redis

        # force init
        await publisher._get_connection()
        assert publisher._redis is not None

        await publisher.aclose()
        assert publisher._redis is None
        assert mock_redis.aclose.call_count == 1


@pytest.mark.asyncio
async def test_redis_publisher_publish_failure(publisher):
    with patch(
        "app.adapters.external.redis_event_bus.aioredis.from_url"
    ) as mock_from_url:
        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock(side_effect=Exception("Redis down"))
        mock_from_url.return_value = mock_redis

        with patch("app.adapters.external.redis_event_bus.asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            with pytest.raises(EventBusPublishError) as exc_info:
                await publisher.publish("test", "t1", "p1", {})
            assert "Redis publish failed" in str(exc_info.value)
            assert mock_sleep.call_count == 2


@pytest.mark.asyncio
async def test_redis_publisher_publish_lifecycle_extra(publisher):
    with patch(
        "app.adapters.external.redis_event_bus.aioredis.from_url"
    ) as mock_from_url:
        mock_redis = MagicMock()
        mock_redis.xadd = AsyncMock(return_value="1620000000-0")
        mock_from_url.return_value = mock_redis

        await publisher.publish_plugin_lifecycle(
            action="failed",
            tenant_id="t1",
            plugin_name="demo",
            plugin_version="1.0.0",
            extra_data={"error": "db_conn"},
        )
        call_args = mock_redis.xadd.call_args[0]
        message_dict = call_args[1]
        event_data = json.loads(message_dict["data"])
        assert event_data["payload"]["error"] == "db_conn"

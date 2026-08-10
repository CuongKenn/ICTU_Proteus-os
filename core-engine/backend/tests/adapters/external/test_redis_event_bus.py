import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.adapters.external.redis_event_bus import RedisEventBusPublisher
import json

@pytest.fixture
def publisher():
    return RedisEventBusPublisher()

@pytest.mark.asyncio
async def test_redis_publisher_publish_success(publisher):
    with patch("app.adapters.external.redis_event_bus.aioredis.from_url") as mock_from_url:
        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock(return_value=1)
        mock_redis.close = AsyncMock()
        mock_from_url.return_value = mock_redis
        
        await publisher.publish_plugin_lifecycle(
            action="INSTALL_STARTED",
            tenant_id="tenant-1",
            plugin_name="demo",
            plugin_version="1.0.0"
        )
        
        assert mock_redis.publish.call_count == 1
        call_args = mock_redis.publish.call_args[0]
        # Check topic
        assert "proteus:events:plugin" in call_args[0]
        
        # Check envelope
        event_data = json.loads(call_args[1])
        assert event_data["event_type"] == "plugin.INSTALL_STARTED"
        assert event_data["tenant_id"] == "tenant-1"
        assert event_data["payload"]["plugin_name"] == "demo"
        assert "event_id" in event_data
        assert "created_at" in event_data

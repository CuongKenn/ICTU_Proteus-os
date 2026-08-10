import pytest
from unittest.mock import patch, AsyncMock
import httpx
from app.adapters.external.mattermost_adapter import MattermostAdapter, MattermostAdapterError
from app.infrastructure.config import settings

@pytest.fixture
def adapter():
    with patch("app.adapters.external.mattermost_adapter.settings") as mock_settings:
        mock_settings.MATTERMOST_URL = "http://mattermost:8065"
        mock_settings.MATTERMOST_BOT_TOKEN = "fake-token"
        adapter = MattermostAdapter()
        return adapter

@pytest.mark.asyncio
async def test_send_message_success(adapter):
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = {"id": "msg_123"}
        mock_post.return_value.raise_for_status = AsyncMock()
        
        result = await adapter.send_message("chan_123", "Hello World")
        
        assert result == {"id": "msg_123"}
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs["json"]["channel_id"] == "chan_123"
        assert kwargs["json"]["message"] == "Hello World"

@pytest.mark.asyncio
async def test_send_message_http_error(adapter):
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_response = httpx.Response(400, text="Bad Request")
        mock_post.side_effect = httpx.HTTPStatusError("Error", request=httpx.Request("POST", ""), response=mock_response)
        
        with pytest.raises(MattermostAdapterError) as exc_info:
            await adapter.send_message("chan_123", "Hello World")
            
        assert "HTTP Error: 400" in str(exc_info.value)

@pytest.mark.asyncio
async def test_send_interactive_message_success(adapter):
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value.json.return_value = {"id": "msg_456"}
        mock_post.return_value.raise_for_status = AsyncMock()
        
        result = await adapter.send_interactive_message(
            channel_id="chan_123",
            text="Approve this?",
            action_id="action_789",
            extra_context={"foo": "bar"}
        )
        
        assert result == {"id": "msg_456"}
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        json_payload = kwargs["json"]
        assert json_payload["channel_id"] == "chan_123"
        
        attachments = json_payload["props"]["attachments"]
        assert len(attachments) == 1
        actions = attachments[0]["actions"]
        assert len(actions) == 2
        assert actions[0]["integration"]["context"]["action"] == "approve"
        assert actions[0]["integration"]["context"]["action_id"] == "action_789"
        assert actions[0]["integration"]["context"]["foo"] == "bar"

@pytest.mark.asyncio
async def test_missing_token_returns_empty():
    with patch("app.adapters.external.mattermost_adapter.settings") as mock_settings:
        mock_settings.MATTERMOST_URL = "http://mattermost:8065"
        mock_settings.MATTERMOST_BOT_TOKEN = ""
        adapter = MattermostAdapter()
        
        res1 = await adapter.send_message("chan_123", "Hello")
        assert res1 == {}
        
        res2 = await adapter.send_interactive_message("chan_123", "Hello", "act_1")
        assert res2 == {}

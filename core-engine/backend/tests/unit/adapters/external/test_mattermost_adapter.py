# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import pytest
import httpx
from unittest.mock import AsyncMock, patch
from app.adapters.external.mattermost_adapter import MattermostAdapter, MattermostAdapterError

@pytest.fixture
def mock_client():
    return AsyncMock(spec=httpx.AsyncClient)

@pytest.fixture
def adapter(mock_client):
    with patch("app.adapters.external.mattermost_adapter.settings") as mock_settings:
        mock_settings.MATTERMOST_URL = "http://mattermost.local"
        mock_settings.MATTERMOST_BOT_TOKEN = "test_token"
        yield MattermostAdapter(client=mock_client)

@pytest.mark.asyncio
async def test_send_message_success(adapter, mock_client):
    mock_request = httpx.Request("POST", "http://test")
    mock_response = httpx.Response(201, json={"id": "msg-123", "message": "Hello"}, request=mock_request)
    mock_client.post.return_value = mock_response

    result = await adapter.send_message("channel-123", "Hello")
    assert result["id"] == "msg-123"
    mock_client.post.assert_called_once()

@pytest.mark.asyncio
async def test_send_message_no_token(adapter, mock_client):
    adapter.token = None
    result = await adapter.send_message("channel-123", "Hello")
    
    assert result == {}
    mock_client.post.assert_not_called()

@pytest.mark.asyncio
async def test_send_message_http_error(adapter, mock_client):
    mock_client.post.return_value = httpx.Response(403, text="Forbidden")
    mock_client.post.return_value.request = httpx.Request("POST", "http://test")
    
    with pytest.raises(MattermostAdapterError, match="HTTP Error: 403"):
        await adapter.send_message("channel-123", "Hello")

@pytest.mark.asyncio
async def test_send_interactive_message_success(adapter, mock_client):
    mock_request = httpx.Request("POST", "http://test")
    mock_response = httpx.Response(201, json={"id": "msg-123"}, request=mock_request)
    mock_client.post.return_value = mock_response

    result = await adapter.send_interactive_message(
        channel_id="channel-123", 
        text="Approve this?", 
        action_id="action-123", 
        extra_context={"tenant_id": "t-1"}
    )
    
    assert result["id"] == "msg-123"
    
    # Verify payload structure
    call_kwargs = mock_client.post.call_args[1]
    payload = call_kwargs["json"]
    assert payload["channel_id"] == "channel-123"
    assert "approveButton" in str(payload)
    assert payload["props"]["attachments"][0]["actions"][0]["integration"]["context"]["tenant_id"] == "t-1"

@pytest.mark.asyncio
async def test_send_interactive_message_no_token(adapter, mock_client):
    adapter.token = None
    result = await adapter.send_interactive_message("channel-123", "Text", "act-1")
    assert result == {}
    mock_client.post.assert_not_called()

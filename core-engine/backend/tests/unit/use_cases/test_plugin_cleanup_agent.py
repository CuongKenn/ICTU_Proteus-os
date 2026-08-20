# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock

import pytest

from app.core.use_cases.plugin_cleanup_agent import PluginCleanupAgent


@pytest.fixture
def mock_plugin_repo():
    return AsyncMock()


@pytest.fixture
def mock_mattermost_adapter():
    return AsyncMock()


@pytest.fixture
def agent(mock_plugin_repo, mock_mattermost_adapter):
    return PluginCleanupAgent(
        plugin_repo=mock_plugin_repo,
        mattermost_adapter=mock_mattermost_adapter,
    )


@pytest.mark.asyncio
async def test_run_no_failed_plugins(agent, mock_plugin_repo):
    mock_plugin_repo.get_failed_dirty_plugins.return_value = []
    await agent.run()
    agent.mattermost_adapter.send_interactive_message.assert_not_called()


@pytest.mark.asyncio
async def test_run_success(agent, mock_plugin_repo, mock_mattermost_adapter):
    tenant_id = uuid.uuid4()
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_failed_dirty_plugins.return_value = [
        (tenant_id, plugin_id, "test-plugin")
    ]

    await agent.run()

    # Kiểm tra thông báo Mattermost được gửi
    agent.mattermost_adapter.send_interactive_message.assert_called_once()
    call_kwargs = agent.mattermost_adapter.send_interactive_message.call_args.kwargs
    assert "Cần thủ công gỡ cài đặt" in call_kwargs["text"]
    assert "action_type" in call_kwargs["extra_context"]


@pytest.mark.asyncio
async def test_run_failure_sends_alert(
    agent, mock_plugin_repo, mock_mattermost_adapter, caplog
):
    tenant_id = uuid.uuid4()
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_failed_dirty_plugins.return_value = [
        (tenant_id, plugin_id, "test-plugin")
    ]

    agent.mattermost_adapter.send_interactive_message.side_effect = Exception("Slack Error")

    await agent.run()

    # Logger báo lỗi
    assert "Gửi cảnh báo cleanup thất bại cho plugin test-plugin" in caplog.text

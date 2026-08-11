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
    # Mock remaining dependencies
    return PluginCleanupAgent(
        plugin_repo=mock_plugin_repo,
        manifest_parser=AsyncMock(),
        n8n_adapter=AsyncMock(),
        metabase_adapter=AsyncMock(),
        appsmith_adapter=AsyncMock(),
        keycloak_adapter=AsyncMock(),
        mattermost_adapter=mock_mattermost_adapter,
        session=AsyncMock(),
    )


@pytest.mark.asyncio
async def test_run_no_failed_plugins(agent, mock_plugin_repo):
    mock_plugin_repo.get_failed_dirty_plugins.return_value = []
    await agent.run()
    agent.uninstall_use_case.uninstall_plugin = AsyncMock()
    agent.uninstall_use_case.uninstall_plugin.assert_not_called()


@pytest.mark.asyncio
async def test_run_success(agent, mock_plugin_repo, mock_mattermost_adapter):
    tenant_id = uuid.uuid4()
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_failed_dirty_plugins.return_value = [
        (tenant_id, plugin_id, "test-plugin")
    ]

    agent.uninstall_use_case.uninstall_plugin = AsyncMock()

    await agent.run()

    agent.uninstall_use_case.uninstall_plugin.assert_called_once()
    mock_mattermost_adapter.send_notification.assert_called_once()
    call_kwargs = mock_mattermost_adapter.send_notification.call_args.kwargs
    assert "đã được dọn dẹp khỏi Tenant" in call_kwargs["message"]


@pytest.mark.asyncio
async def test_run_failure_sends_alert(
    agent, mock_plugin_repo, mock_mattermost_adapter
):
    tenant_id = uuid.uuid4()
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_failed_dirty_plugins.return_value = [
        (tenant_id, plugin_id, "test-plugin")
    ]

    agent.uninstall_use_case.uninstall_plugin = AsyncMock(
        side_effect=Exception("DB Error")
    )

    await agent.run()

    agent.uninstall_use_case.uninstall_plugin.assert_called_once()
    mock_mattermost_adapter.send_notification.assert_called_once()
    call_kwargs = mock_mattermost_adapter.send_notification.call_args.kwargs
    assert "CRITICAL ALERT" in call_kwargs["message"]
    assert "DB Error" in call_kwargs["message"]

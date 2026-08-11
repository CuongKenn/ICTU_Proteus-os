# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.domain.entities import PluginEntity, PluginStatus, TenantContext
from app.core.use_cases.plugin_toggle import PluginToggleError, PluginToggleUseCase


@pytest.fixture
def mock_plugin_repo():
    return AsyncMock()


@pytest.fixture
def use_case(mock_plugin_repo):
    return PluginToggleUseCase(plugin_repo=mock_plugin_repo)


@pytest.fixture
def tenant_context():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["tenant_admin"],
        full_name="Admin",
    )


@pytest.mark.asyncio
async def test_disable_plugin_success(use_case, mock_plugin_repo, tenant_context):
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_by_id.return_value = PluginEntity(
        id=plugin_id,
        code_name="test-plugin",
        display_name="Test Plugin",
        version="1.0.0",
        is_official=True,
    )
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.ACTIVE

    await use_case.disable_plugin(context=tenant_context, plugin_id=plugin_id)

    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=plugin_id,
        status=PluginStatus.DISABLED,
    )


@pytest.mark.asyncio
async def test_disable_plugin_not_active(use_case, mock_plugin_repo, tenant_context):
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_by_id.return_value = PluginEntity(
        id=plugin_id,
        code_name="test-plugin",
        display_name="Test Plugin",
        version="1.0.0",
        is_official=True,
    )
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.INSTALLING

    with pytest.raises(PluginToggleError, match="không ở trạng thái ACTIVE"):
        await use_case.disable_plugin(context=tenant_context, plugin_id=plugin_id)


@pytest.mark.asyncio
async def test_enable_plugin_success(use_case, mock_plugin_repo, tenant_context):
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_by_id.return_value = PluginEntity(
        id=plugin_id,
        code_name="test-plugin",
        display_name="Test Plugin",
        version="1.0.0",
        is_official=True,
    )
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.DISABLED

    await use_case.enable_plugin(context=tenant_context, plugin_id=plugin_id)

    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=plugin_id,
        status=PluginStatus.ACTIVE,
    )


@pytest.mark.asyncio
async def test_enable_plugin_not_disabled(use_case, mock_plugin_repo, tenant_context):
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_by_id.return_value = PluginEntity(
        id=plugin_id,
        code_name="test-plugin",
        display_name="Test Plugin",
        version="1.0.0",
        is_official=True,
    )
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.ACTIVE

    with pytest.raises(PluginToggleError, match="không ở trạng thái DISABLED"):
        await use_case.enable_plugin(context=tenant_context, plugin_id=plugin_id)

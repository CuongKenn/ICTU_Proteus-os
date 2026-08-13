# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, MagicMock, mock_open, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain.entities import PluginEntity, PluginStatus, TenantContext
from app.core.domain.plugin_manifest import PluginManifest
from app.core.use_cases.plugin_install import PluginInstallError, PluginInstallUseCase


@pytest.fixture
def mock_plugin_repo():
    repo = AsyncMock()
    return repo


@pytest.fixture
def mock_manifest_parser():
    parser = MagicMock()
    return parser


@pytest.fixture
def mock_n8n_adapter():
    return AsyncMock()


@pytest.fixture
def mock_metabase_adapter():
    return AsyncMock()


@pytest.fixture
def mock_appsmith_adapter():
    return AsyncMock()


@pytest.fixture
def mock_keycloak_adapter():
    return AsyncMock()


@pytest.fixture
def mock_mattermost_adapter():
    return AsyncMock()


@pytest.fixture
def mock_session():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def plugin_install_use_case(
    mock_plugin_repo,
    mock_manifest_parser,
    mock_n8n_adapter,
    mock_metabase_adapter,
    mock_appsmith_adapter,
    mock_keycloak_adapter,
    mock_mattermost_adapter,
    mock_session,
):
    return PluginInstallUseCase(
        plugin_repo=mock_plugin_repo,
        manifest_parser=mock_manifest_parser,
        n8n_adapter=mock_n8n_adapter,
        metabase_adapter=mock_metabase_adapter,
        appsmith_adapter=mock_appsmith_adapter,
        keycloak_adapter=mock_keycloak_adapter,
        mattermost_adapter=mock_mattermost_adapter,
        session=mock_session,
    )


@pytest.fixture
def tenant_context():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["superadmin"],
        email="test@example.com",
        full_name="Test User",
    )


@pytest.fixture
def sample_plugin():
    return PluginEntity(
        id=uuid.uuid4(),
        code_name="hr-module",
        display_name="HR Core Pro",
        version="1.2.0",
    )


@pytest.fixture
def sample_manifest():
    return PluginManifest(
        name="hr-module",
        display_name="HR Core Pro",
        version="1.2.0",
        description="Test",
        author="Test",
        license="AGPL-3.0",
        compatibility={"proteus_os_min_version": "1.0.0"},
        database={"tables": ["test"], "seed_file": "seed.sql"},
        workflows=[{"file": "wf.json", "name": "wf", "trigger": "webhook"}],
        dashboards=[{"file": "db.json", "name": "db"}],
        ui_apps=[{"file": "app.json", "name": "app", "path": "/apps/hr"}],
        roles=[{"name": "hr_manager", "display_name": "HR Manager"}],
        event_subscriptions=[
            {
                "source_plugin": "finance",
                "event_types": ["a"],
                "handler_workflow": "h.json",
            }
        ],
    )


@pytest.mark.asyncio
async def test_execute_success(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_session,
    mock_mattermost_adapter,
    tenant_context,
    sample_plugin,
    sample_manifest,
):
    # Setup
    mock_plugin_repo.get_by_code_name.return_value = sample_plugin
    mock_plugin_repo.get_installation_status.return_value = None
    mock_manifest_parser.parse.return_value = sample_manifest

    # Mock file reading and json loading
    m_open = mock_open(read_data="SELECT 1;")
    with patch("builtins.open", m_open):
        with patch("pathlib.Path.exists", return_value=True):
            with patch("json.load", return_value={"mocked": "json"}):
                await plugin_install_use_case.execute(tenant_context, "hr-module")

    # Assert
    mock_plugin_repo.upsert_installation.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=sample_plugin.id,
        status=PluginStatus.INSTALLING,
        installed_version=sample_manifest.version,
    )
    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=sample_plugin.id,
        status=PluginStatus.ACTIVE,
    )
    assert (
        mock_session.execute.call_count == 3
    )  # CREATE SCHEMA, SET search_path, and seed.sql
    mock_mattermost_adapter.send_message.assert_called_once()


@pytest.mark.asyncio
async def test_execute_plugin_not_found(
    plugin_install_use_case,
    mock_plugin_repo,
    tenant_context,
):
    mock_plugin_repo.get_by_code_name.return_value = None

    with pytest.raises(PluginInstallError, match="không tồn tại"):
        await plugin_install_use_case.execute(tenant_context, "non-existent")


@pytest.mark.asyncio
async def test_execute_plugin_already_installed(
    plugin_install_use_case,
    mock_plugin_repo,
    tenant_context,
    sample_plugin,
):
    mock_plugin_repo.get_by_code_name.return_value = sample_plugin
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.ACTIVE

    with pytest.raises(PluginInstallError, match="đang ở trạng thái ACTIVE"):
        await plugin_install_use_case.execute(tenant_context, "hr-module")


@pytest.mark.asyncio
async def test_execute_rollback_on_failure(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_session,
    mock_mattermost_adapter,
    tenant_context,
    sample_plugin,
    sample_manifest,
):
    mock_plugin_repo.get_by_code_name.return_value = sample_plugin
    mock_plugin_repo.get_installation_status.return_value = None
    mock_manifest_parser.parse.return_value = sample_manifest

    # Force failure on session.execute
    mock_session.execute.side_effect = Exception("DB Error")

    m_open = mock_open(read_data="SELECT 1;")
    with patch("builtins.open", m_open):
        with patch("pathlib.Path.exists", return_value=True):
            with pytest.raises(PluginInstallError, match="DB Error"):
                await plugin_install_use_case.execute(tenant_context, "hr-module")

    # Assert rollback occurred
    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=sample_plugin.id,
        status=PluginStatus.FAILED_DIRTY,
        error_log="DB Error",
    )


@pytest.mark.asyncio
async def test_execute_fails_with_malicious_sql(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_session,
    tenant_context,
    sample_plugin,
    sample_manifest,
):
    mock_plugin_repo.get_by_code_name.return_value = sample_plugin
    mock_plugin_repo.get_installation_status.return_value = None
    mock_manifest_parser.parse.return_value = sample_manifest

    # Provide malicious SQL with DROP TABLE
    m_open = mock_open(read_data="DROP TABLE users;")
    with patch("builtins.open", m_open):
        with patch("pathlib.Path.exists", return_value=True):
            with pytest.raises(
                PluginInstallError, match="Seed file chứa các lệnh SQL không được phép"
            ):
                await plugin_install_use_case.execute(tenant_context, "hr-module")

    # Assert execute was never called
    mock_session.execute.assert_not_called()

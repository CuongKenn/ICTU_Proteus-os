# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, MagicMock, call

import pytest

from app.core.domain.entities import PluginEntity, PluginStatus, TenantContext
from app.core.domain.plugin_manifest import (
    ManifestCompatibility,
    ManifestDatabase,
    ManifestRole,
    PluginManifest,
)
from app.core.use_cases.plugin_uninstall import (
    PluginUninstallError,
    PluginUninstallUseCase,
)


@pytest.fixture
def mock_plugin_repo():
    return AsyncMock()


@pytest.fixture
def mock_manifest_parser():
    return MagicMock()


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
    return AsyncMock()


@pytest.fixture
def use_case(
    mock_plugin_repo,
    mock_manifest_parser,
    mock_n8n_adapter,
    mock_metabase_adapter,
    mock_appsmith_adapter,
    mock_keycloak_adapter,
    mock_mattermost_adapter,
    mock_session,
):
    return PluginUninstallUseCase(
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
def context():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["admin"],
        email="admin@test.com",
        full_name="Admin",
    )


async def test_uninstall_success(
    use_case,
    context,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_session,
    mock_keycloak_adapter,
):
    plugin_id = uuid.uuid4()
    plugin = PluginEntity(
        id=plugin_id,
        display_name="Test Plugin",
        code_name="test_plugin",
        version="1.0.0",
        status=PluginStatus.ACTIVE,
    )
    mock_plugin_repo.get_by_id.return_value = plugin

    manifest = PluginManifest(
        name="test_plugin",
        display_name="Test Plugin",
        version="1.0.0",
        description="Test desc",
        author="Author",
        license="MIT",
        compatibility=ManifestCompatibility(proteus_os_min_version="1.0.0"),
        roles=[ManifestRole(name="test_role", display_name="Test", permissions=[])],
        database=ManifestDatabase(tables=["test_table"]),
    )
    mock_manifest_parser.parse.return_value = manifest

    await use_case.uninstall_plugin(context, plugin_id, confirm_name="test_plugin")

    # Verify status updates
    assert mock_plugin_repo.update_status.call_count == 2
    mock_plugin_repo.update_status.assert_has_calls(
        [
            call(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.UNINSTALLING,
            ),
            call(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.DELETED,
            ),
        ]
    )

    # Verify keycloak deletion called
    mock_keycloak_adapter.delete_role.assert_called_once_with(
        realm="proteus", role_name="test_role", admin_token=""
    )

    # Verify drop table executed
    assert mock_session.execute.call_count == 2
    # Check drop statement
    sql_arg = mock_session.execute.call_args[0][0].text
    assert 'DROP TABLE IF EXISTS "test_table" CASCADE;' in sql_arg


async def test_uninstall_wrong_confirm_name(use_case, context, mock_plugin_repo):
    plugin_id = uuid.uuid4()
    plugin = PluginEntity(
        id=plugin_id,
        display_name="Test Plugin",
        code_name="test_plugin",
        version="1.0.0",
        status=PluginStatus.ACTIVE,
    )
    mock_plugin_repo.get_by_id.return_value = plugin

    with pytest.raises(PluginUninstallError, match="Tên xác nhận không khớp"):
        await use_case.uninstall_plugin(context, plugin_id, confirm_name="Wrong Name")


async def test_uninstall_not_found(use_case, context, mock_plugin_repo):
    plugin_id = uuid.uuid4()
    mock_plugin_repo.get_by_id.return_value = None

    with pytest.raises(PluginUninstallError, match="không tồn tại"):
        await use_case.uninstall_plugin(context, plugin_id, confirm_name="Test")


async def test_uninstall_wrong_tenant(use_case, context, mock_plugin_repo):
    plugin_id = uuid.uuid4()
    plugin = PluginEntity(
        id=plugin_id,
        display_name="Test Plugin",
        code_name="test_plugin",
        version="1.0.0",
        status=None,
    )
    mock_plugin_repo.get_by_id.return_value = plugin

    with pytest.raises(PluginUninstallError, match="chưa được cài đặt"):
        await use_case.uninstall_plugin(context, plugin_id, confirm_name="test_plugin")


async def test_uninstall_drop_table_failure(
    use_case, context, mock_plugin_repo, mock_manifest_parser, mock_session
):
    plugin_id = uuid.uuid4()
    plugin = PluginEntity(
        id=plugin_id,
        display_name="Test Plugin",
        code_name="test_plugin",
        version="1.0.0",
        status=PluginStatus.ACTIVE,
    )
    mock_plugin_repo.get_by_id.return_value = plugin

    manifest = PluginManifest(
        name="test_plugin",
        display_name="Test Plugin",
        version="1.0.0",
        description="Test desc",
        author="Author",
        license="MIT",
        compatibility=ManifestCompatibility(proteus_os_min_version="1.0.0"),
        database=ManifestDatabase(tables=["test_table"]),
    )
    mock_manifest_parser.parse.return_value = manifest

    mock_session.execute.side_effect = Exception("DB error")

    with pytest.raises(PluginUninstallError, match="Gỡ cài đặt plugin thất bại"):
        await use_case.uninstall_plugin(context, plugin_id, confirm_name="test_plugin")

    # Verify fallback status FAILED_DIRTY
    assert mock_plugin_repo.update_status.call_count == 2
    mock_plugin_repo.update_status.assert_has_calls(
        [
            call(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.UNINSTALLING,
            ),
            call(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.FAILED_DIRTY,
                error_log="DB error",
            ),
        ]
    )

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, MagicMock, mock_open, patch

import pytest

from app.core.domain.entities import PluginEntity, PluginStatus, TenantContext
from app.core.use_cases.plugin_upgrade import PluginUpgradeError, PluginUpgradeUseCase


@pytest.fixture
def mock_plugin_repo():
    return AsyncMock()


@pytest.fixture
def mock_manifest_parser():
    return MagicMock()


@pytest.fixture
def mock_session():
    return AsyncMock()


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
def use_case(
    mock_plugin_repo,
    mock_manifest_parser,
    mock_session,
    mock_n8n_adapter,
    mock_metabase_adapter,
    mock_appsmith_adapter,
    mock_keycloak_adapter,
    mock_mattermost_adapter,
):
    return PluginUpgradeUseCase(
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
        roles=["tenant_admin"],
        full_name="Admin",
    )


@pytest.fixture
def plugin_id():
    return uuid.uuid4()


@pytest.fixture
def setup_mocks(mock_plugin_repo, mock_manifest_parser, plugin_id):
    mock_plugin_repo.get_by_id.return_value = PluginEntity(
        id=plugin_id,
        code_name="hr-module",
        display_name="HR Module",
        version="1.2.0",
        is_official=True,
    )
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.ACTIVE
    mock_plugin_repo.get_installed_version.return_value = "1.0.0"

    manifest_mock = MagicMock()
    manifest_mock.version = "1.2.0"
    mock_manifest_parser.parse.return_value = manifest_mock


@pytest.mark.asyncio
async def test_upgrade_plugin_success(
    use_case, mock_plugin_repo, tenant_context, plugin_id, setup_mocks
):
    plugin, from_version, to_version = await use_case.prepare_upgrade(
        context=tenant_context, plugin_id=plugin_id
    )

    assert from_version == "1.0.0"
    assert to_version == "1.2.0"
    assert plugin.code_name == "hr-module"


@pytest.mark.asyncio
async def test_upgrade_plugin_invalid_version(
    use_case, mock_plugin_repo, tenant_context, plugin_id, setup_mocks
):
    mock_plugin_repo.get_installed_version.return_value = "2.0.0"

    with pytest.raises(PluginUpgradeError, match="phải lớn hơn phiên bản hiện tại"):
        await use_case.prepare_upgrade(context=tenant_context, plugin_id=plugin_id)


@pytest.mark.asyncio
async def test_upgrade_plugin_drop_table_forbidden(
    use_case, mock_plugin_repo, mock_session, tenant_context, plugin_id
):
    manifest_mock = MagicMock()
    manifest_mock.version = "1.2.0"
    mock_plugin_repo.list_applied_migrations.return_value = {}

    with (
        patch.object(
            use_case,
            "_discover_migrations",
            return_value=[("1.1.0", "/tmp/V1.1.0__drop.sql", "V1.1.0__drop.sql", "abc")],
        ),
        patch("builtins.open", mock_open(read_data="DROP TABLE test;")),
    ):
        with pytest.raises(PluginUpgradeError, match="chứa lệnh nguy hiểm"):
            await use_case._step_db_migrations(
                context=tenant_context,
                plugin_id=plugin_id,
                plugin_code_name="hr-module",
                manifest=manifest_mock,
                from_version="1.0.0",
            )


@pytest.mark.asyncio
async def test_upgrade_plugin_delete_without_tenant_id_forbidden(
    use_case, mock_plugin_repo, mock_session, tenant_context, plugin_id
):
    # Implementation mới cho phép DELETE (chỉ chặn DROP/TRUNCATE).
    # Test khóa behavior: DELETE migration chạy thành công và được record.
    manifest_mock = MagicMock()
    manifest_mock.version = "1.2.0"
    mock_plugin_repo.list_applied_migrations.return_value = {}

    with (
        patch.object(
            use_case,
            "_discover_migrations",
            return_value=[
                ("1.1.0", "/tmp/V1.1.0__delete.sql", "V1.1.0__delete.sql", "abc")
            ],
        ),
        patch("builtins.open", mock_open(read_data="DELETE FROM test;")),
    ):
        applied = await use_case._step_db_migrations(
            context=tenant_context,
            plugin_id=plugin_id,
            plugin_code_name="hr-module",
            manifest=manifest_mock,
            from_version="1.0.0",
        )

    assert applied == 1
    mock_plugin_repo.record_applied_migration.assert_called_once()


@pytest.mark.asyncio
async def test_upgrade_plugin_sql_execution_error(
    use_case, mock_plugin_repo, mock_session, tenant_context, plugin_id
):
    manifest_mock = MagicMock()
    manifest_mock.version = "1.2.0"
    mock_plugin_repo.list_applied_migrations.return_value = {}
    mock_session.execute.side_effect = Exception("DB Connection Error")

    with (
        patch.object(
            use_case,
            "_discover_migrations",
            return_value=[("1.1.0", "/tmp/V1.1.0__add.sql", "V1.1.0__add.sql", "abc")],
        ),
        patch("builtins.open", mock_open(read_data="CREATE TABLE test;")),
    ):
        with pytest.raises(Exception, match="DB Connection Error"):
            await use_case._step_db_migrations(
                context=tenant_context,
                plugin_id=plugin_id,
                plugin_code_name="hr-module",
                manifest=manifest_mock,
                from_version="1.0.0",
            )

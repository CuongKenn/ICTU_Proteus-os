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
def use_case(mock_plugin_repo, mock_manifest_parser, mock_session):
    return PluginUpgradeUseCase(
        plugin_repo=mock_plugin_repo,
        manifest_parser=mock_manifest_parser,
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
@patch("app.core.use_cases.plugin_upgrade.os.path.exists", return_value=True)
@patch(
    "app.core.use_cases.plugin_upgrade.os.listdir",
    return_value=[
        "V1.1.0__add.sql",
        "V1.2.0__add.sql",
        "V0.9.0__old.sql",
        "invalid.sql",
    ],
)
@patch("builtins.open", new_callable=mock_open, read_data="CREATE TABLE test;")
async def test_upgrade_plugin_success(
    mock_file,
    mock_listdir,
    mock_exists,
    use_case,
    mock_plugin_repo,
    mock_session,
    tenant_context,
    plugin_id,
    setup_mocks,
):
    await use_case.upgrade_plugin(context=tenant_context, plugin_id=plugin_id)

    assert mock_session.execute.call_count == 5  # SET LOCAL x3 + 2 SQL scripts
    mock_session.commit.assert_called_once()
    mock_plugin_repo.upsert_installation.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=plugin_id,
        status=PluginStatus.ACTIVE,
        installed_version="1.2.0",
    )


@pytest.mark.asyncio
async def test_upgrade_plugin_invalid_version(
    use_case, mock_plugin_repo, tenant_context, plugin_id, setup_mocks
):
    mock_plugin_repo.get_installed_version.return_value = "2.0.0"

    with pytest.raises(PluginUpgradeError, match="phải lớn hơn phiên bản hiện tại"):
        await use_case.upgrade_plugin(context=tenant_context, plugin_id=plugin_id)


@pytest.mark.asyncio
@patch("app.core.use_cases.plugin_upgrade.os.path.exists", return_value=True)
@patch(
    "app.core.use_cases.plugin_upgrade.os.listdir",
    return_value=["V1.1.0__drop.sql"],
)
@patch("builtins.open", new_callable=mock_open, read_data="DROP TABLE test;")
async def test_upgrade_plugin_drop_table_forbidden(
    mock_file,
    mock_listdir,
    mock_exists,
    use_case,
    tenant_context,
    plugin_id,
    setup_mocks,
):
    with pytest.raises(PluginUpgradeError, match="chứa lệnh DROP không được phép"):
        await use_case.upgrade_plugin(context=tenant_context, plugin_id=plugin_id)


@pytest.mark.asyncio
@patch("app.core.use_cases.plugin_upgrade.os.path.exists", return_value=True)
@patch(
    "app.core.use_cases.plugin_upgrade.os.listdir",
    return_value=["V1.1.0__add.sql"],
)
@patch("builtins.open", new_callable=mock_open, read_data="CREATE TABLE test;")
async def test_upgrade_plugin_sql_execution_error(
    mock_file,
    mock_listdir,
    mock_exists,
    use_case,
    mock_plugin_repo,
    mock_session,
    tenant_context,
    plugin_id,
    setup_mocks,
):
    mock_session.execute.side_effect = Exception("DB Connection Error")

    with pytest.raises(PluginUpgradeError, match="Lỗi khi chạy migration"):
        await use_case.upgrade_plugin(context=tenant_context, plugin_id=plugin_id)

    mock_session.rollback.assert_called_once()
    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=plugin_id,
        status=PluginStatus.FAILED_DIRTY,
        error_log="Upgrade failed: DB Connection Error",
    )

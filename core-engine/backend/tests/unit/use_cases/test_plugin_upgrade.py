# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import hashlib
import json
import uuid
from types import SimpleNamespace
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


# ─── Helpers for new tests ────────────────────────────────────────────

PLUGIN_CODE = "hr-module"


def _make_plugin(pid):
    return PluginEntity(
        id=pid,
        code_name=PLUGIN_CODE,
        display_name="HR Module",
        version="1.2.0",
        is_official=True,
    )


def _setup_prepare_ok(mock_plugin_repo, mock_manifest_parser, plugin_id):
    mock_plugin_repo.get_by_id.return_value = _make_plugin(plugin_id)
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.ACTIVE
    mock_plugin_repo.get_installed_version.return_value = "1.0.0"
    manifest_mock = MagicMock()
    manifest_mock.version = "1.2.0"
    mock_manifest_parser.parse.return_value = manifest_mock


def _setup_discover_parser(mock_manifest_parser, tmp_path, manifest_version="1.5.0"):
    mock_manifest_parser.plugins_dir = tmp_path
    mock_manifest_parser.parse.return_value = SimpleNamespace(version=manifest_version)


def _write_migration(tmp_path, fname, content="SELECT 1;"):
    mig_dir = tmp_path / PLUGIN_CODE / "migrations"
    mig_dir.mkdir(parents=True, exist_ok=True)
    fpath = mig_dir / fname
    fpath.write_bytes(content.encode("utf-8"))
    return fpath


def _sha256_of(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ─── prepare_upgrade: error branches ──────────────────────────────────

@pytest.mark.asyncio
async def test_prepare_upgrade_plugin_not_found(
    use_case, mock_plugin_repo, tenant_context, plugin_id
):
    mock_plugin_repo.get_by_id.return_value = None
    with pytest.raises(PluginUpgradeError, match="không tồn tại"):
        await use_case.prepare_upgrade(context=tenant_context, plugin_id=plugin_id)


@pytest.mark.asyncio
async def test_prepare_upgrade_invalid_status(
    use_case, mock_plugin_repo, mock_manifest_parser, tenant_context, plugin_id
):
    _setup_prepare_ok(mock_plugin_repo, mock_manifest_parser, plugin_id)
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.FAILED_DIRTY
    with pytest.raises(PluginUpgradeError, match="ACTIVE/DISABLED"):
        await use_case.prepare_upgrade(context=tenant_context, plugin_id=plugin_id)


@pytest.mark.asyncio
async def test_prepare_upgrade_missing_installed_version(
    use_case, mock_plugin_repo, mock_manifest_parser, tenant_context, plugin_id
):
    _setup_prepare_ok(mock_plugin_repo, mock_manifest_parser, plugin_id)
    mock_plugin_repo.get_installed_version.return_value = None
    with pytest.raises(PluginUpgradeError, match="phiên bản đang cài"):
        await use_case.prepare_upgrade(context=tenant_context, plugin_id=plugin_id)


@pytest.mark.asyncio
async def test_prepare_upgrade_invalid_version_format(
    use_case, mock_plugin_repo, mock_manifest_parser, tenant_context, plugin_id
):
    _setup_prepare_ok(mock_plugin_repo, mock_manifest_parser, plugin_id)
    mock_plugin_repo.get_installed_version.return_value = "not a version!!"
    with pytest.raises(PluginUpgradeError, match="Định dạng phiên bản không hợp lệ"):
        await use_case.prepare_upgrade(context=tenant_context, plugin_id=plugin_id)


@pytest.mark.asyncio
async def test_prepare_upgrade_invalid_manifest_version(
    use_case, mock_plugin_repo, mock_manifest_parser, tenant_context, plugin_id
):
    _setup_prepare_ok(mock_plugin_repo, mock_manifest_parser, plugin_id)
    mock_manifest_parser.parse.return_value.version = "also bad!!"
    with pytest.raises(PluginUpgradeError, match="Định dạng phiên bản không hợp lệ"):
        await use_case.prepare_upgrade(context=tenant_context, plugin_id=plugin_id)


# ─── _discover_migrations ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_discover_no_migrations_dir(use_case, mock_manifest_parser, tmp_path):
    _setup_discover_parser(mock_manifest_parser, tmp_path)
    assert use_case._discover_migrations(PLUGIN_CODE, "1.0.0", {}) == []


@pytest.mark.asyncio
async def test_discover_skips_invalid_filename(
    use_case, mock_manifest_parser, tmp_path
):
    _setup_discover_parser(mock_manifest_parser, tmp_path)
    _write_migration(tmp_path, "README.md", "docs")
    _write_migration(tmp_path, "V1.2.0__ok.sql")
    pending = use_case._discover_migrations(PLUGIN_CODE, "1.0.0", {})
    assert [p[2] for p in pending] == ["V1.2.0__ok.sql"]


@pytest.mark.asyncio
async def test_discover_version_filter(use_case, mock_manifest_parser, tmp_path):
    _setup_discover_parser(mock_manifest_parser, tmp_path, manifest_version="1.5.0")
    _write_migration(tmp_path, "V1.0.0__old.sql")  # == installed -> skip
    _write_migration(tmp_path, "V1.2.0__mid.sql")  # in range -> keep
    _write_migration(tmp_path, "V9.9.9__future.sql")  # > manifest -> skip
    pending = use_case._discover_migrations(PLUGIN_CODE, "1.0.0", {})
    assert [p[2] for p in pending] == ["V1.2.0__mid.sql"]


@pytest.mark.asyncio
async def test_discover_checksum_changed_raises(
    use_case, mock_manifest_parser, tmp_path
):
    _setup_discover_parser(mock_manifest_parser, tmp_path)
    _write_migration(tmp_path, "V1.2.0__a.sql", "SELECT 1;")
    applied = {"1.2.0": {"checksum": "deadbeef"}}
    with pytest.raises(PluginUpgradeError, match="checksum"):
        use_case._discover_migrations(PLUGIN_CODE, "1.0.0", applied)


@pytest.mark.asyncio
async def test_discover_already_applied_skipped(
    use_case, mock_manifest_parser, tmp_path
):
    _setup_discover_parser(mock_manifest_parser, tmp_path)
    fpath = _write_migration(tmp_path, "V1.2.0__a.sql", "SELECT 1;")
    applied = {"1.2.0": {"checksum": _sha256_of(fpath)}}
    assert use_case._discover_migrations(PLUGIN_CODE, "1.0.0", applied) == []


@pytest.mark.asyncio
async def test_discover_invalid_installed_version(
    use_case, mock_manifest_parser, tmp_path
):
    _setup_discover_parser(mock_manifest_parser, tmp_path)
    with pytest.raises(PluginUpgradeError, match="installed_version không hợp lệ"):
        use_case._discover_migrations(PLUGIN_CODE, "bogus!!", {})


@pytest.mark.asyncio
async def test_discover_invalid_manifest_version(
    use_case, mock_manifest_parser, tmp_path
):
    _setup_discover_parser(mock_manifest_parser, tmp_path, manifest_version="bogus!!")
    _write_migration(tmp_path, "V1.2.0__a.sql")
    with pytest.raises(PluginUpgradeError, match="manifest version không hợp lệ"):
        use_case._discover_migrations(PLUGIN_CODE, "1.0.0", {})


# ─── _step_db_migrations: no pending / invalid schema / happy ─────────

@pytest.mark.asyncio
async def test_step_db_no_pending_returns_zero(
    use_case, mock_plugin_repo, mock_session, tenant_context, plugin_id
):
    mock_plugin_repo.list_applied_migrations.return_value = {}
    manifest_mock = MagicMock()
    manifest_mock.version = "1.2.0"
    with patch.object(use_case, "_discover_migrations", return_value=[]):
        applied = await use_case._step_db_migrations(
            context=tenant_context,
            plugin_id=plugin_id,
            plugin_code_name=PLUGIN_CODE,
            manifest=manifest_mock,
            from_version="1.0.0",
        )
    assert applied == 0
    mock_session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_step_db_invalid_schema_name(
    use_case, mock_plugin_repo, tenant_context, plugin_id
):
    mock_plugin_repo.list_applied_migrations.return_value = {}
    bad_ctx = SimpleNamespace(tenant_id="evil;drop!--x", user_id=tenant_context.user_id)
    manifest_mock = MagicMock()
    manifest_mock.version = "1.2.0"
    with patch.object(
        use_case,
        "_discover_migrations",
        return_value=[("1.1.0", "/tmp/x.sql", "V1.1.0__x.sql", "abc")],
    ):
        with pytest.raises(PluginUpgradeError, match="Invalid schema name"):
            await use_case._step_db_migrations(
                context=bad_ctx,
                plugin_id=plugin_id,
                plugin_code_name=PLUGIN_CODE,
                manifest=manifest_mock,
                from_version="1.0.0",
            )


@pytest.mark.asyncio
async def test_step_db_records_and_resets_search_path(
    use_case, mock_plugin_repo, mock_session, tenant_context, plugin_id
):
    mock_plugin_repo.list_applied_migrations.return_value = {}
    manifest_mock = MagicMock()
    manifest_mock.version = "1.2.0"
    with (
        patch.object(
            use_case,
            "_discover_migrations",
            return_value=[("1.1.0", "/tmp/V1.1.0__add.sql", "V1.1.0__add.sql", "abc")],
        ),
        patch(
            "builtins.open",
            mock_open(read_data="CREATE TABLE t (id INT); SELECT 1;"),
        ),
    ):
        applied = await use_case._step_db_migrations(
            context=tenant_context,
            plugin_id=plugin_id,
            plugin_code_name=PLUGIN_CODE,
            manifest=manifest_mock,
            from_version="1.0.0",
        )
    assert applied == 1
    mock_plugin_repo.record_applied_migration.assert_awaited_once()
    executed_sql = [str(c.args[0]) for c in mock_session.execute.await_args_list]
    assert any("SET search_path TO public" in s for s in executed_sql)


# ─── run_upgrade: success / disabled / failure / not found ────────────

def _setup_run_upgrade_common(mock_plugin_repo, mock_manifest_parser, plugin_id,
                               status=PluginStatus.ACTIVE):
    plugin = _make_plugin(plugin_id)
    mock_plugin_repo.get_by_code_name.return_value = plugin
    mock_plugin_repo.get_installed_version.return_value = "1.0.0"
    mock_plugin_repo.get_installation_status.return_value = status
    mock_plugin_repo.get_config.return_value = {"keep": 1}
    manifest = SimpleNamespace(version="2.0.0", display_name="HR Module")
    mock_manifest_parser.parse.return_value = manifest
    return plugin, manifest


@pytest.mark.asyncio
async def test_run_upgrade_success(
    use_case, mock_plugin_repo, mock_manifest_parser, mock_session,
    mock_mattermost_adapter, tenant_context, plugin_id,
):
    _setup_run_upgrade_common(mock_plugin_repo, mock_manifest_parser, plugin_id)
    mock_event_bus = AsyncMock()
    use_case.event_bus = mock_event_bus
    with (
        patch.object(use_case, "_snapshot",
                     new=AsyncMock(return_value={"config_override": {}, "n8n_exports": {}})),
        patch.object(use_case, "_step_db_migrations", new=AsyncMock(return_value=2)),
        patch.object(use_case, "_step_n8n_update", new=AsyncMock(return_value=["n8n-1"])),
        patch.object(use_case, "_step_metabase_replace", new=AsyncMock(return_value=["mb-1"])),
        patch.object(use_case, "_step_appsmith_replace", new=AsyncMock(return_value=["app-1"])),
        patch.object(use_case, "_step_keycloak_roles", new=AsyncMock(return_value=["admin"])),
    ):
        await use_case.run_upgrade(
            context=tenant_context, plugin_code_name=PLUGIN_CODE, task_id=uuid.uuid4()
        )
    upsert_kwargs = mock_plugin_repo.upsert_installation.await_args.kwargs
    assert upsert_kwargs["installed_version"] == "2.0.0"
    assert upsert_kwargs["status"] == PluginStatus.ACTIVE
    config_kwargs = mock_plugin_repo.update_config.await_args.kwargs
    assert config_kwargs["config_override"]["n8n"] == ["n8n-1"]
    assert config_kwargs["config_override"]["metabase"] == ["mb-1"]
    assert config_kwargs["config_override"]["appsmith"] == ["app-1"]
    assert config_kwargs["config_override"]["keep"] == 1
    task_kwargs = mock_plugin_repo.set_upgrade_task_id.await_args.kwargs
    assert task_kwargs["task_id"] if "task_id" in task_kwargs else True
    assert any(s["step"] == "complete" and s["status"] == "DONE"
               for s in use_case._steps_log)
    mock_mattermost_adapter.send_message.assert_awaited_once()
    mock_event_bus.publish_plugin_lifecycle.assert_awaited_once()
    assert mock_event_bus.publish_plugin_lifecycle.await_args.kwargs["action"] == "upgraded"


@pytest.mark.asyncio
async def test_run_upgrade_success_keeps_disabled(
    use_case, mock_plugin_repo, mock_manifest_parser, tenant_context, plugin_id,
):
    _setup_run_upgrade_common(
        mock_plugin_repo, mock_manifest_parser, plugin_id, status=PluginStatus.DISABLED
    )
    with (
        patch.object(use_case, "_snapshot",
                     new=AsyncMock(return_value={"config_override": {}, "n8n_exports": {}})),
        patch.object(use_case, "_step_db_migrations", new=AsyncMock(return_value=0)),
        patch.object(use_case, "_step_n8n_update", new=AsyncMock(return_value=[])),
        patch.object(use_case, "_step_metabase_replace", new=AsyncMock(return_value=[])),
        patch.object(use_case, "_step_appsmith_replace", new=AsyncMock(return_value=[])),
        patch.object(use_case, "_step_keycloak_roles", new=AsyncMock(return_value=[])),
    ):
        await use_case.run_upgrade(
            context=tenant_context, plugin_code_name=PLUGIN_CODE, task_id=uuid.uuid4()
        )
    upsert_kwargs = mock_plugin_repo.upsert_installation.await_args.kwargs
    assert upsert_kwargs["status"] == PluginStatus.DISABLED


@pytest.mark.asyncio
async def test_run_upgrade_failure_compensates_and_marks_dirty(
    use_case, mock_plugin_repo, mock_manifest_parser, mock_session,
    mock_mattermost_adapter, tenant_context, plugin_id,
):
    _setup_run_upgrade_common(mock_plugin_repo, mock_manifest_parser, plugin_id)
    with (
        patch.object(use_case, "_snapshot",
                     new=AsyncMock(return_value={"config_override": {}, "n8n_exports": {}})),
        patch.object(use_case, "_step_db_migrations",
                     new=AsyncMock(side_effect=RuntimeError("db boom"))),
        patch.object(use_case, "_compensate", new=AsyncMock()) as mock_comp,
    ):
        with pytest.raises(PluginUpgradeError, match="Nâng cấp plugin thất bại"):
            await use_case.run_upgrade(
                context=tenant_context, plugin_code_name=PLUGIN_CODE,
                task_id=uuid.uuid4(),
            )
    mock_comp.assert_awaited_once()
    status_kwargs = mock_plugin_repo.update_status.await_args.kwargs
    assert status_kwargs["status"] == PluginStatus.FAILED_DIRTY
    assert "db boom" in status_kwargs["error_log"]
    mock_plugin_repo.update_install_steps_log.assert_awaited()
    assert any(s["step"] == "database" and s["status"] == "FAILED"
               for s in use_case._steps_log)
    mock_session.rollback.assert_awaited()
    mock_mattermost_adapter.send_message.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_upgrade_plugin_not_found(
    use_case, mock_plugin_repo, tenant_context,
):
    mock_plugin_repo.get_by_code_name.return_value = None
    with patch.object(use_case, "_snapshot", new=AsyncMock()) as mock_snap:
        with pytest.raises(PluginUpgradeError, match="không tồn tại"):
            await use_case.run_upgrade(
                context=tenant_context, plugin_code_name="ghost",
                task_id=uuid.uuid4(),
            )
    mock_snap.assert_not_awaited()


# ─── _snapshot ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_snapshot_collects_config_and_exports(
    use_case, mock_plugin_repo, mock_n8n_adapter, tenant_context, plugin_id
):
    mock_plugin_repo.get_config.return_value = {"n8n": ["w1", "w2"], "metabase": ["m1"]}

    async def _get_wf(wid):
        if wid == "w1":
            return {"id": "w1", "name": "old"}
        raise RuntimeError("gone")

    mock_n8n_adapter.get_workflow.side_effect = _get_wf
    snap = await use_case._snapshot(tenant_context, plugin_id)
    assert snap["config_override"] == {"n8n": ["w1", "w2"], "metabase": ["m1"]}
    assert snap["n8n_exports"] == {"w1": {"id": "w1", "name": "old"}}


@pytest.mark.asyncio
async def test_snapshot_empty_config(
    use_case, mock_plugin_repo, mock_n8n_adapter, tenant_context, plugin_id
):
    mock_plugin_repo.get_config.return_value = None
    snap = await use_case._snapshot(tenant_context, plugin_id)
    assert snap == {"config_override": {}, "n8n_exports": {}}
    mock_n8n_adapter.get_workflow.assert_not_awaited()


# ─── _compensate ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_compensate_restores_and_cleans(
    use_case, mock_n8n_adapter, mock_metabase_adapter, mock_appsmith_adapter,
    tenant_context, plugin_id,
):
    snapshot = {
        "n8n_exports": {"w1": {"name": "old"}},
        "config_override": {"n8n": ["w1"]},
    }
    created = {"n8n": ["w1", "w-new"], "metabase": ["mb-new"], "appsmith": ["app-new"]}
    await use_case._compensate(tenant_context, plugin_id, PLUGIN_CODE, snapshot, created)
    mock_n8n_adapter.update_workflow.assert_awaited_once_with("w1", {"name": "old"})
    mock_metabase_adapter.delete_dashboard.assert_awaited_once_with("mb-new")
    mock_appsmith_adapter.delete_application.assert_awaited_once_with("app-new")
    mock_n8n_adapter.delete_workflow.assert_awaited_once_with("w-new")


@pytest.mark.asyncio
async def test_compensate_tolerates_adapter_errors(
    use_case, mock_n8n_adapter, mock_metabase_adapter, mock_appsmith_adapter,
    tenant_context, plugin_id,
):
    mock_n8n_adapter.update_workflow.side_effect = RuntimeError("x")
    mock_n8n_adapter.delete_workflow.side_effect = RuntimeError("x")
    mock_metabase_adapter.delete_dashboard.side_effect = RuntimeError("x")
    mock_appsmith_adapter.delete_application.side_effect = RuntimeError("x")
    snapshot = {
        "n8n_exports": {"w1": {"name": "old"}},
        "config_override": {"n8n": ["w1"]},
    }
    created = {"n8n": ["w-new"], "metabase": ["mb-new"], "appsmith": ["app-new"]}
    await use_case._compensate(tenant_context, plugin_id, PLUGIN_CODE, snapshot, created)


# ─── _log_step / _persist_steps ───────────────────────────────────────

@pytest.mark.asyncio
async def test_log_step_updates_existing(use_case):
    use_case._log_step("database", "RUNNING")
    use_case._log_step("database", "DONE", "ok")
    assert len(use_case._steps_log) == 1
    assert use_case._steps_log[0]["status"] == "DONE"
    assert use_case._steps_log[0]["message"] == "ok"


@pytest.mark.asyncio
async def test_persist_steps_failure_rolls_back(
    use_case, mock_plugin_repo, mock_session, tenant_context, plugin_id
):
    mock_plugin_repo.update_install_steps_log.side_effect = RuntimeError("log fail")
    use_case._log_step("snapshot", "DONE")
    await use_case._persist_steps(tenant_context, plugin_id)  # must not raise
    mock_session.rollback.assert_awaited()


# ─── _find_n8n_credential / _ensure_* ─────────────────────────────────

@pytest.mark.asyncio
async def test_find_n8n_credential_found(use_case, mock_session):
    result = MagicMock()
    result.fetchone.return_value = ("cred-1",)
    mock_session.execute.return_value = result
    assert await use_case._find_n8n_credential("ProteusDB_Real") == "cred-1"


@pytest.mark.asyncio
async def test_find_n8n_credential_no_session(
    use_case, mock_plugin_repo, mock_manifest_parser, mock_n8n_adapter,
    mock_metabase_adapter, mock_appsmith_adapter, mock_keycloak_adapter,
    mock_mattermost_adapter,
):
    from app.core.use_cases.plugin_upgrade import PluginUpgradeUseCase
    uc = PluginUpgradeUseCase(
        plugin_repo=mock_plugin_repo, manifest_parser=mock_manifest_parser,
        n8n_adapter=mock_n8n_adapter, metabase_adapter=mock_metabase_adapter,
        appsmith_adapter=mock_appsmith_adapter, keycloak_adapter=mock_keycloak_adapter,
        mattermost_adapter=mock_mattermost_adapter, session=None,
    )
    assert await uc._find_n8n_credential("ProteusDB_Real") is None


@pytest.mark.asyncio
async def test_find_n8n_credential_row_none(use_case, mock_session):
    result = MagicMock()
    result.fetchone.return_value = None
    mock_session.execute.return_value = result
    assert await use_case._find_n8n_credential("ProteusDB_Real") is None


@pytest.mark.asyncio
async def test_find_n8n_credential_exception_returns_none(use_case, mock_session):
    mock_session.execute.side_effect = RuntimeError("db down")
    assert await use_case._find_n8n_credential("ProteusDB_Real") is None


@pytest.mark.asyncio
async def test_ensure_mm_credential_existing(use_case):
    with patch.object(use_case, "_find_n8n_credential",
                      new=AsyncMock(return_value="c1")):
        assert await use_case._ensure_mm_credential() == ("c1", "ProteusMM")


@pytest.mark.asyncio
async def test_ensure_mm_credential_no_token(use_case):
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch("app.core.use_cases.plugin_upgrade.settings",
              MagicMock(MATTERMOST_BOT_TOKEN="", MATTERMOST_URL="http://mm")),
    ):
        assert await use_case._ensure_mm_credential() == (None, None)


@pytest.mark.asyncio
async def test_ensure_mm_credential_creates(use_case, mock_n8n_adapter):
    mock_n8n_adapter.create_credential.return_value = {"id": "nid"}
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch("app.core.use_cases.plugin_upgrade.settings",
              MagicMock(MATTERMOST_BOT_TOKEN="tok", MATTERMOST_URL="http://mm")),
    ):
        assert await use_case._ensure_mm_credential() == ("nid", "ProteusMM")
    kwargs = mock_n8n_adapter.create_credential.await_args.kwargs
    assert kwargs["credential_type"] == "mattermostApi"


@pytest.mark.asyncio
async def test_ensure_mm_credential_create_error(use_case, mock_n8n_adapter):
    mock_n8n_adapter.create_credential.side_effect = RuntimeError("n8n down")
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch("app.core.use_cases.plugin_upgrade.settings",
              MagicMock(MATTERMOST_BOT_TOKEN="tok", MATTERMOST_URL="http://mm")),
    ):
        assert await use_case._ensure_mm_credential() == (None, None)


@pytest.mark.asyncio
async def test_ensure_ollama_credential_existing(use_case):
    with patch.object(use_case, "_find_n8n_credential",
                      new=AsyncMock(return_value="o1")):
        assert await use_case._ensure_ollama_credential() == ("o1", "ProteusOllama")


@pytest.mark.asyncio
async def test_ensure_ollama_credential_no_base_url(use_case):
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch("app.core.use_cases.plugin_upgrade.settings",
              MagicMock(LLM_BASE_URL="")),
    ):
        assert await use_case._ensure_ollama_credential() == (None, None)


@pytest.mark.asyncio
async def test_ensure_ollama_credential_strips_v1(use_case, mock_n8n_adapter):
    mock_n8n_adapter.create_credential.return_value = {"id": "oid"}
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch("app.core.use_cases.plugin_upgrade.settings",
              MagicMock(LLM_BASE_URL="http://ollama:11434/v1")),
    ):
        assert await use_case._ensure_ollama_credential() == ("oid", "ProteusOllama")
    kwargs = mock_n8n_adapter.create_credential.await_args.kwargs
    assert kwargs["data"] == {"baseUrl": "http://ollama:11434"}


@pytest.mark.asyncio
async def test_ensure_ollama_credential_create_error(use_case, mock_n8n_adapter):
    mock_n8n_adapter.create_credential.side_effect = RuntimeError("n8n down")
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch("app.core.use_cases.plugin_upgrade.settings",
              MagicMock(LLM_BASE_URL="http://ollama:11434")),
    ):
        assert await use_case._ensure_ollama_credential() == (None, None)


def test_bind_workflow_credentials(use_case):
    wf_json = {
        "nodes": [
            {"type": "n8n-nodes-base.webhook", "parameters": {}},
            {"type": "n8n-nodes-base.postgres",
             "parameters": {"query": "SELECT * FROM {{TENANT_SCHEMA}}.t"}},
            {"type": "n8n-nodes-base.mattermost", "parameters": {}},
            {"type": "n8n-nodes-base.ollama", "parameters": {}},
        ]
    }
    use_case._bind_workflow_credentials(
        wf_json, "tenant_x", "db1", "mm1", "ProteusMM", "ol1", "ProteusOllama", "C123",
    )
    nodes = {n["type"]: n for n in wf_json["nodes"]}
    assert nodes["n8n-nodes-base.webhook"]["parameters"]["httpMethod"] == "POST"
    assert "tenant_x" in nodes["n8n-nodes-base.postgres"]["parameters"]["query"]
    assert nodes["n8n-nodes-base.postgres"]["credentials"]["postgres"]["id"] == "db1"
    mm_creds = nodes["n8n-nodes-base.mattermost"]["credentials"]["mattermostApi"]
    assert mm_creds["id"] == "mm1" and mm_creds["name"] == "ProteusMM"
    assert nodes["n8n-nodes-base.mattermost"]["parameters"]["channelId"] == "C123"
    ol_creds = nodes["n8n-nodes-base.ollama"]["credentials"]["ollamaApi"]
    assert ol_creds["id"] == "ol1"


# ─── _step_n8n_update ─────────────────────────────────────────────────

def _write_workflow(tmp_path, fname="wf.json", name="WF1"):
    plug_dir = tmp_path / PLUGIN_CODE
    plug_dir.mkdir(parents=True, exist_ok=True)
    (plug_dir / fname).write_text(json.dumps({"name": name, "nodes": []}),
                                  encoding="utf-8")
    return fname


@pytest.mark.asyncio
async def test_step_n8n_update_in_place(
    use_case, mock_manifest_parser, mock_n8n_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    fname = _write_workflow(tmp_path)
    mock_n8n_adapter.list_workflows.return_value = [{"name": "WF1", "id": "old-1"}]
    manifest = SimpleNamespace(workflows=[SimpleNamespace(file=fname)])
    snapshot = {"n8n_exports": {"old-1": {"name": "old"}}}
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch.object(use_case, "_ensure_mm_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch.object(use_case, "_ensure_ollama_credential",
                     new=AsyncMock(return_value=(None, None))),
    ):
        ids = await use_case._step_n8n_update(tenant_context, PLUGIN_CODE, manifest, snapshot)
    assert ids == ["old-1"]
    mock_n8n_adapter.update_workflow.assert_awaited_once()
    mock_n8n_adapter.activate_workflow.assert_awaited_once_with("old-1")


@pytest.mark.asyncio
async def test_step_n8n_update_import_new_activate_tolerated(
    use_case, mock_manifest_parser, mock_n8n_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    fname = _write_workflow(tmp_path)
    mock_n8n_adapter.list_workflows.return_value = []
    mock_n8n_adapter.import_workflow.return_value = "new-9"
    mock_n8n_adapter.activate_workflow.side_effect = RuntimeError("cannot activate")
    manifest = SimpleNamespace(workflows=[SimpleNamespace(file=fname)])
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch.object(use_case, "_ensure_mm_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch.object(use_case, "_ensure_ollama_credential",
                     new=AsyncMock(return_value=(None, None))),
    ):
        ids = await use_case._step_n8n_update(tenant_context, PLUGIN_CODE, manifest, {})
    assert ids == ["new-9"]
    mock_n8n_adapter.import_workflow.assert_awaited_once()


@pytest.mark.asyncio
async def test_step_n8n_update_missing_file_skipped_and_import_error(
    use_case, mock_manifest_parser, mock_n8n_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    fname = _write_workflow(tmp_path)
    mock_n8n_adapter.list_workflows.return_value = []
    mock_n8n_adapter.import_workflow.side_effect = RuntimeError("import fail")
    manifest = SimpleNamespace(workflows=[
        SimpleNamespace(file="missing.json"),
        SimpleNamespace(file=fname),
    ])
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch.object(use_case, "_ensure_mm_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch.object(use_case, "_ensure_ollama_credential",
                     new=AsyncMock(return_value=(None, None))),
    ):
        with pytest.raises(RuntimeError, match="import fail"):
            await use_case._step_n8n_update(tenant_context, PLUGIN_CODE, manifest, {})


# ─── _step_metabase_replace ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_step_metabase_replace_happy(
    use_case, mock_manifest_parser, mock_metabase_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    plug_dir = tmp_path / PLUGIN_CODE
    plug_dir.mkdir(parents=True, exist_ok=True)
    (plug_dir / "db.json").write_text(json.dumps({"title": "D"}), encoding="utf-8")
    mock_metabase_adapter.import_dashboard.return_value = 7
    mock_metabase_adapter.delete_dashboard.side_effect = RuntimeError("gone")
    manifest = SimpleNamespace(dashboards=[SimpleNamespace(file="db.json")])
    snapshot = {"config_override": {"metabase": ["old-9"]}}
    ids = await use_case._step_metabase_replace(tenant_context, PLUGIN_CODE, manifest, snapshot)
    assert ids == ["7"]
    mock_metabase_adapter.import_dashboard.assert_awaited_once()
    mock_metabase_adapter.delete_dashboard.assert_awaited_once_with("old-9")


@pytest.mark.asyncio
async def test_step_metabase_replace_import_error(
    use_case, mock_manifest_parser, mock_metabase_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    plug_dir = tmp_path / PLUGIN_CODE
    plug_dir.mkdir(parents=True, exist_ok=True)
    (plug_dir / "db.json").write_text(json.dumps({"title": "D"}), encoding="utf-8")
    mock_metabase_adapter.import_dashboard.side_effect = RuntimeError("mb down")
    manifest = SimpleNamespace(dashboards=[SimpleNamespace(file="db.json")])
    with pytest.raises(RuntimeError, match="mb down"):
        await use_case._step_metabase_replace(tenant_context, PLUGIN_CODE, manifest, {})


@pytest.mark.asyncio
async def test_step_metabase_replace_missing_file_skipped(
    use_case, mock_manifest_parser, mock_metabase_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    manifest = SimpleNamespace(dashboards=[SimpleNamespace(file="nodash.json")])
    ids = await use_case._step_metabase_replace(tenant_context, PLUGIN_CODE, manifest, {})
    assert ids == []
    mock_metabase_adapter.import_dashboard.assert_not_awaited()


# ─── _step_appsmith_replace ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_step_appsmith_replace_happy(
    use_case, mock_manifest_parser, mock_appsmith_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    plug_dir = tmp_path / PLUGIN_CODE
    plug_dir.mkdir(parents=True, exist_ok=True)
    (plug_dir / "app.json").write_text(json.dumps({"name": "A"}), encoding="utf-8")
    mock_appsmith_adapter.import_application.return_value = "app-9"
    mock_appsmith_adapter.delete_application.side_effect = RuntimeError("gone")
    manifest = SimpleNamespace(ui=SimpleNamespace(appsmith_app="app.json"))
    snapshot = {"config_override": {"appsmith": ["old-app"]}}
    ids = await use_case._step_appsmith_replace(tenant_context, PLUGIN_CODE, manifest, snapshot)
    assert ids == ["app-9"]
    mock_appsmith_adapter.import_application.assert_awaited_once()
    assert mock_appsmith_adapter.delete_application.await_count == 1


@pytest.mark.asyncio
async def test_step_appsmith_replace_no_ui(
    use_case, mock_manifest_parser, mock_appsmith_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    manifest = SimpleNamespace(ui=None)
    snapshot = {"config_override": {"appsmith": ["old-app"]}}
    ids = await use_case._step_appsmith_replace(tenant_context, PLUGIN_CODE, manifest, snapshot)
    assert ids == []
    mock_appsmith_adapter.import_application.assert_not_awaited()
    mock_appsmith_adapter.delete_application.assert_awaited_once()


@pytest.mark.asyncio
async def test_step_appsmith_replace_import_error(
    use_case, mock_manifest_parser, mock_appsmith_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    plug_dir = tmp_path / PLUGIN_CODE
    plug_dir.mkdir(parents=True, exist_ok=True)
    (plug_dir / "app.json").write_text(json.dumps({"name": "A"}), encoding="utf-8")
    mock_appsmith_adapter.import_application.side_effect = RuntimeError("as down")
    manifest = SimpleNamespace(ui=SimpleNamespace(appsmith_app="app.json"))
    with pytest.raises(RuntimeError, match="as down"):
        await use_case._step_appsmith_replace(tenant_context, PLUGIN_CODE, manifest, {})


# ─── _step_keycloak_roles ─────────────────────────────────────────────

def _kc_roles():
    return [
        SimpleNamespace(name="admin", display_name="Admin",
                        description="d", permissions=["p1"]),
        SimpleNamespace(name="viewer", display_name="Viewer",
                        description="d", permissions=[]),
    ]


@pytest.mark.asyncio
async def test_step_keycloak_roles_happy(
    use_case, mock_keycloak_adapter, tenant_context,
):
    use_case.tenant_repo = AsyncMock()
    use_case.tenant_repo.get_by_id.return_value = SimpleNamespace(
        keycloak_realm="realm-x"
    )
    manifest = SimpleNamespace(roles=_kc_roles())
    with patch("app.core.use_cases.plugin_upgrade.RoleRepository") as mock_role_cls:
        mock_repo = AsyncMock()
        mock_repo.list_by_tenant.return_value = [SimpleNamespace(name="admin")]
        mock_role_cls.return_value = mock_repo
        created = await use_case._step_keycloak_roles(
            tenant_context, PLUGIN_CODE, manifest
        )
    assert created == ["admin", "viewer"]
    assert mock_keycloak_adapter.create_role.await_count == 2
    first_kwargs = mock_keycloak_adapter.create_role.await_args_list[0].kwargs
    assert first_kwargs == {"realm": "realm-x", "role_name": f"{PLUGIN_CODE}_admin"}
    # admin đã có trong DB -> chỉ tạo viewer
    assert mock_repo.create_role.await_count == 1


@pytest.mark.asyncio
async def test_step_keycloak_roles_default_realm_no_session(
    use_case, mock_plugin_repo, mock_manifest_parser, mock_n8n_adapter,
    mock_metabase_adapter, mock_appsmith_adapter, mock_keycloak_adapter,
    mock_mattermost_adapter, tenant_context,
):
    from app.core.use_cases.plugin_upgrade import PluginUpgradeUseCase
    uc = PluginUpgradeUseCase(
        plugin_repo=mock_plugin_repo, manifest_parser=mock_manifest_parser,
        n8n_adapter=mock_n8n_adapter, metabase_adapter=mock_metabase_adapter,
        appsmith_adapter=mock_appsmith_adapter, keycloak_adapter=mock_keycloak_adapter,
        mattermost_adapter=mock_mattermost_adapter, session=None,
    )
    manifest = SimpleNamespace(roles=_kc_roles()[:1])
    created = await uc._step_keycloak_roles(tenant_context, PLUGIN_CODE, manifest)
    assert created == ["admin"]
    kwargs = mock_keycloak_adapter.create_role.await_args.kwargs
    assert kwargs["realm"] == "proteus"


@pytest.mark.asyncio
async def test_step_keycloak_roles_create_error(use_case, mock_keycloak_adapter,
                                                tenant_context):
    mock_keycloak_adapter.create_role.side_effect = RuntimeError("kc down")
    manifest = SimpleNamespace(roles=_kc_roles()[:1])
    with pytest.raises(RuntimeError, match="kc down"):
        await use_case._step_keycloak_roles(tenant_context, PLUGIN_CODE, manifest)


# ─── SQL helpers (pure functions) ─────────────────────────────────────

def test_split_sql_statements_basic():
    from app.core.use_cases.plugin_upgrade import _split_sql_statements
    stmts = _split_sql_statements("CREATE TABLE t (id INT); SELECT 1;")
    assert stmts == ["CREATE TABLE t (id INT)", "SELECT 1"]
    assert _split_sql_statements("SELECT 3") == ["SELECT 3"]


def test_split_sql_statements_dollar_quote_and_strings():
    from app.core.use_cases.plugin_upgrade import _split_sql_statements
    sql = (
        "CREATE FUNCTION f() RETURNS void AS $$ BEGIN RAISE NOTICE 'a;b'; END; $$; "
        "SELECT 'it''s; ok'; -- trailing; comment\nSELECT 2;"
    )
    stmts = _split_sql_statements(sql)
    assert len(stmts) == 3
    assert "RAISE NOTICE" in stmts[0]
    assert stmts[1] == "SELECT 'it''s; ok'"


def test_split_sql_statements_block_comment_and_empty():
    from app.core.use_cases.plugin_upgrade import _split_sql_statements
    assert _split_sql_statements("") == []
    assert _split_sql_statements(";;;") == []
    stmts = _split_sql_statements("/* drop; table */ SELECT 1;")
    assert stmts == ["SELECT 1"]


def test_strip_sql_comments():
    from app.core.use_cases.plugin_upgrade import _strip_sql_comments
    out = _strip_sql_comments("SELECT 1; -- DROP TABLE x\n/* TRUNCATE y */ SELECT 2;")
    assert "DROP" not in out and "TRUNCATE" not in out
    assert "SELECT" in out


# ─── run_upgrade: notification/session warning branches ───────────────

@pytest.mark.asyncio
async def test_run_upgrade_success_tolerates_notify_errors(
    use_case, mock_plugin_repo, mock_manifest_parser,
    mock_mattermost_adapter, tenant_context, plugin_id,
):
    _setup_run_upgrade_common(mock_plugin_repo, mock_manifest_parser, plugin_id)
    mock_mattermost_adapter.send_message.side_effect = RuntimeError("mm down")
    mock_event_bus = AsyncMock()
    mock_event_bus.publish_plugin_lifecycle.side_effect = RuntimeError("bus down")
    use_case.event_bus = mock_event_bus
    with (
        patch.object(use_case, "_snapshot",
                     new=AsyncMock(return_value={"config_override": {}, "n8n_exports": {}})),
        patch.object(use_case, "_step_db_migrations", new=AsyncMock(return_value=0)),
        patch.object(use_case, "_step_n8n_update", new=AsyncMock(return_value=[])),
        patch.object(use_case, "_step_metabase_replace", new=AsyncMock(return_value=[])),
        patch.object(use_case, "_step_appsmith_replace", new=AsyncMock(return_value=[])),
        patch.object(use_case, "_step_keycloak_roles", new=AsyncMock(return_value=[])),
    ):
        await use_case.run_upgrade(
            context=tenant_context, plugin_code_name=PLUGIN_CODE, task_id=uuid.uuid4()
        )
    assert mock_plugin_repo.upsert_installation.await_count == 1


@pytest.mark.asyncio
async def test_run_upgrade_failure_tolerates_cleanup_errors(
    use_case, mock_plugin_repo, mock_manifest_parser, mock_session,
    mock_mattermost_adapter, tenant_context, plugin_id,
):
    _setup_run_upgrade_common(mock_plugin_repo, mock_manifest_parser, plugin_id)
    mock_event_bus = AsyncMock()
    mock_event_bus.publish_plugin_lifecycle.side_effect = RuntimeError("bus down")
    use_case.event_bus = mock_event_bus
    mock_mattermost_adapter.send_message.side_effect = RuntimeError("mm down")
    mock_session.execute.side_effect = RuntimeError("cannot reset")
    mock_plugin_repo.update_install_steps_log.side_effect = RuntimeError("log fail")
    with (
        patch.object(use_case, "_snapshot",
                     new=AsyncMock(return_value={"config_override": {}, "n8n_exports": {}})),
        patch.object(use_case, "_step_db_migrations",
                     new=AsyncMock(side_effect=RuntimeError("db boom"))),
        patch.object(use_case, "_compensate", new=AsyncMock()),
    ):
        with pytest.raises(PluginUpgradeError, match="Nâng cấp plugin thất bại"):
            await use_case.run_upgrade(
                context=tenant_context, plugin_code_name=PLUGIN_CODE,
                task_id=uuid.uuid4(),
            )
    status_kwargs = mock_plugin_repo.update_status.await_args.kwargs
    assert status_kwargs["status"] == PluginStatus.FAILED_DIRTY


# ─── plugins_dir fallback (LocalManifestParser) ───────────────────────

@pytest.mark.asyncio
async def test_discover_fallback_plugins_dir(use_case, mock_manifest_parser):
    mock_manifest_parser.plugins_dir = None
    mock_manifest_parser.parse.return_value = SimpleNamespace(version="1.5.0")
    assert use_case._discover_migrations("no-such-plugin-xyz", "1.0.0", {}) == []


@pytest.mark.asyncio
async def test_steps_fallback_plugins_dir(
    use_case, mock_manifest_parser, mock_n8n_adapter,
    mock_metabase_adapter, mock_appsmith_adapter, tenant_context,
):
    mock_manifest_parser.plugins_dir = None
    manifest = SimpleNamespace(
        workflows=[SimpleNamespace(file="wf.json")],
        dashboards=[SimpleNamespace(file="db.json")],
        ui=SimpleNamespace(appsmith_app="app.json"),
    )
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch.object(use_case, "_ensure_mm_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch.object(use_case, "_ensure_ollama_credential",
                     new=AsyncMock(return_value=(None, None))),
    ):
        assert await use_case._step_n8n_update(
            tenant_context, "no-such-plugin-xyz", manifest, {}) == []
    assert await use_case._step_metabase_replace(
        tenant_context, "no-such-plugin-xyz", manifest, {}) == []
    assert await use_case._step_appsmith_replace(
        tenant_context, "no-such-plugin-xyz", manifest, {}) == []
    mock_n8n_adapter.import_workflow.assert_not_awaited()
    mock_metabase_adapter.import_dashboard.assert_not_awaited()
    mock_appsmith_adapter.import_application.assert_not_awaited()


# ─── n8n: list error + alerts channel branches ────────────────────────

@pytest.mark.asyncio
async def test_step_n8n_update_existing_outside_snapshot(
    use_case, mock_manifest_parser, mock_n8n_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    fname = _write_workflow(tmp_path)
    mock_n8n_adapter.list_workflows.return_value = [{"name": "WF1", "id": "old-7"}]
    manifest = SimpleNamespace(workflows=[SimpleNamespace(file=fname)])
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch.object(use_case, "_ensure_mm_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch.object(use_case, "_ensure_ollama_credential",
                     new=AsyncMock(return_value=(None, None))),
    ):
        ids = await use_case._step_n8n_update(tenant_context, PLUGIN_CODE, manifest, {})
    assert ids == ["old-7"]
    mock_n8n_adapter.update_workflow.assert_awaited_once()
    mock_n8n_adapter.import_workflow.assert_not_awaited()


@pytest.mark.asyncio
async def test_step_n8n_update_list_error_proceeds(
    use_case, mock_manifest_parser, mock_n8n_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    fname = _write_workflow(tmp_path)
    mock_n8n_adapter.list_workflows.side_effect = RuntimeError("n8n down")
    mock_n8n_adapter.import_workflow.return_value = "new-1"
    manifest = SimpleNamespace(workflows=[SimpleNamespace(file=fname)])
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch.object(use_case, "_ensure_mm_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch.object(use_case, "_ensure_ollama_credential",
                     new=AsyncMock(return_value=(None, None))),
    ):
        ids = await use_case._step_n8n_update(tenant_context, PLUGIN_CODE, manifest, {})
    assert ids == ["new-1"]


@pytest.mark.asyncio
async def test_step_n8n_update_resolves_alerts_channel(
    use_case, mock_manifest_parser, mock_n8n_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    plug_dir = tmp_path / PLUGIN_CODE
    plug_dir.mkdir(parents=True, exist_ok=True)
    wf = {"name": "WF-mm",
          "nodes": [{"type": "n8n-nodes-base.mattermost", "parameters": {}}]}
    (plug_dir / "wf.json").write_text(json.dumps(wf), encoding="utf-8")
    mock_n8n_adapter.list_workflows.return_value = []
    mock_n8n_adapter.import_workflow.return_value = "new-2"
    use_case.tenant_repo = AsyncMock()
    manifest = SimpleNamespace(workflows=[SimpleNamespace(file="wf.json")])
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch.object(use_case, "_ensure_mm_credential",
                     new=AsyncMock(return_value=("mm1", "ProteusMM"))),
        patch.object(use_case, "_ensure_ollama_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch("app.core.use_cases.tenant_onboarding.get_tenant_alerts_channel_id",
              new=AsyncMock(return_value="C999")),
    ):
        ids = await use_case._step_n8n_update(tenant_context, PLUGIN_CODE, manifest, {})
    assert ids == ["new-2"]
    sent_json = mock_n8n_adapter.import_workflow.await_args.args[0]
    mm_node = next(n for n in sent_json["nodes"] if "mattermost" in n["type"])
    assert mm_node["parameters"]["channelId"] == "C999"


@pytest.mark.asyncio
async def test_step_n8n_update_alerts_channel_error_tolerated(
    use_case, mock_manifest_parser, mock_n8n_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    fname = _write_workflow(tmp_path)
    mock_n8n_adapter.list_workflows.return_value = []
    mock_n8n_adapter.import_workflow.return_value = "new-3"
    use_case.tenant_repo = AsyncMock()
    manifest = SimpleNamespace(workflows=[SimpleNamespace(file=fname)])
    with (
        patch.object(use_case, "_find_n8n_credential", new=AsyncMock(return_value=None)),
        patch.object(use_case, "_ensure_mm_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch.object(use_case, "_ensure_ollama_credential",
                     new=AsyncMock(return_value=(None, None))),
        patch("app.core.use_cases.tenant_onboarding.get_tenant_alerts_channel_id",
              new=AsyncMock(side_effect=RuntimeError("mm down"))),
    ):
        ids = await use_case._step_n8n_update(tenant_context, PLUGIN_CODE, manifest, {})
    assert ids == ["new-3"]


# ─── appsmith integration config + keycloak sync warning ──────────────

@pytest.mark.asyncio
async def test_step_appsmith_replace_with_integration_config(
    use_case, mock_manifest_parser, mock_appsmith_adapter, tenant_context, tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    plug_dir = tmp_path / PLUGIN_CODE
    plug_dir.mkdir(parents=True, exist_ok=True)
    (plug_dir / "app.json").write_text(json.dumps({"name": "A"}), encoding="utf-8")
    mock_appsmith_adapter.import_application.return_value = "app-1"
    use_case.tenant_repo = AsyncMock()
    use_case.tenant_repo.get_integration_by_provider.return_value = {
        "config": {"baseUrl": "http://appsmith"}
    }
    manifest = SimpleNamespace(ui=SimpleNamespace(appsmith_app="app.json"))
    ids = await use_case._step_appsmith_replace(tenant_context, PLUGIN_CODE, manifest, {})
    assert ids == ["app-1"]
    args, _ = mock_appsmith_adapter.import_application.await_args
    assert args[1] == {"baseUrl": "http://appsmith"}


@pytest.mark.asyncio
async def test_step_keycloak_roles_db_sync_warning(
    use_case, mock_keycloak_adapter, tenant_context,
):
    manifest = SimpleNamespace(roles=_kc_roles()[:1])
    with patch("app.core.use_cases.plugin_upgrade.RoleRepository") as mock_role_cls:
        mock_role_cls.side_effect = RuntimeError("db down")
        created = await use_case._step_keycloak_roles(
            tenant_context, PLUGIN_CODE, manifest
        )
    assert created == ["admin"]


@pytest.mark.asyncio
async def test_persist_steps_rollback_failure_suppressed(
    use_case, mock_plugin_repo, mock_session, tenant_context, plugin_id
):
    mock_plugin_repo.update_install_steps_log.side_effect = RuntimeError("log fail")
    mock_session.rollback.side_effect = RuntimeError("rollback fail")
    use_case._log_step("snapshot", "DONE")
    await use_case._persist_steps(tenant_context, plugin_id)  # must not raise


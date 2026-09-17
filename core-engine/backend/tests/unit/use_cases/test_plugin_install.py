# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import sys
import types
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, mock_open, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain.entities import (
    CredentialInput,
    PluginEntity,
    PluginStatus,
    TenantContext,
)
from app.core.domain.plugin_manifest import ManifestCompatibility, PluginManifest
from app.core.use_cases.plugin_install import (
    PluginInstallError,
    PluginInstallUseCase,
    _split_seed_statements_safe,
    _validate_seed_statement,
)


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
    session = AsyncMock(spec=AsyncSession)
    # Giả lập Result SYNC như SQLAlchemy thật: child mặc định của
    # AsyncMock là async nên res.fetchone() trả về coroutine → lỗi
    # "'coroutine' object is not subscriptable" trong _step_2_n8n.
    execute_result = MagicMock()
    execute_result.fetchone.return_value = None  # chưa có credential ProteusDB_Real
    session.execute.return_value = execute_result
    return session


@pytest.fixture
def mock_event_bus():
    return AsyncMock()


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
    mock_event_bus,
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
        event_bus=mock_event_bus,
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
    mock_event_bus,
    tenant_context,
    sample_plugin,
    sample_manifest,
):
    # Setup
    mock_plugin_repo.get_by_code_name.return_value = sample_plugin
    mock_plugin_repo.get_installation_status.return_value = None
    mock_manifest_parser.parse.return_value = sample_manifest

    # Mock file reading and json loading (seed phải pass allowlist
    # CREATE TABLE/INDEX/INSERT — SELECT bị chặn từ hardening C4)
    m_open = mock_open(read_data="CREATE TABLE test (id UUID PRIMARY KEY);")
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
    assert mock_session.execute.call_count == 26
    # advisory lock (1) + CREATE SCHEMA, SET LOCAL search_path,
    # SET LOCAL statement_timeout, SAVEPOINT, seed stmt, RELEASE SAVEPOINT,
    # SET search_path TO public (7) + RLS block (CREATE SCHEMA, SET search_path,
    # SAVEPOINT, CREATE ROLE, RELEASE, SELECT columns, RESET search_path = 7)
    # + 3 lookups credential n8n (ProteusDB_Real/ProteusMM/ProteusOllama)
    # + 1 list DB roles (asset tracking)
    # + 7 RESET search_path trong _persist_steps (database/n8n/metabase/
    # appsmith/keycloak/events/complete) để chống kẹt schema tenant
    mock_mattermost_adapter.send_message.assert_called_once()
    mock_event_bus.publish_plugin_lifecycle.assert_called_once_with(
        action="installed",
        tenant_id=str(tenant_context.tenant_id),
        plugin_name="hr-module",
        plugin_version=sample_manifest.version,
    )


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

    with pytest.raises(PluginInstallError, match="đang ACTIVE"):
        await plugin_install_use_case.execute(tenant_context, "hr-module")


@pytest.mark.asyncio
async def test_execute_rollback_on_failure(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_session,
    mock_mattermost_adapter,
    mock_event_bus,
    tenant_context,
    sample_plugin,
    sample_manifest,
):
    mock_plugin_repo.get_by_code_name.return_value = sample_plugin
    mock_plugin_repo.get_installation_status.return_value = None
    mock_manifest_parser.parse.return_value = sample_manifest
    mock_session.execute.side_effect = Exception("DB Error")

    # Dùng seed hợp lệ để qua được validation C4, lỗi DB mới bộc lộ ở
    # CREATE SCHEMA (advisory lock best-effort đã nuốt lỗi đầu nên message
    # vẫn là "DB Error" như kỳ vọng).
    with patch("builtins.open", mock_open(read_data="CREATE TABLE test (id UUID PRIMARY KEY);")):
        with patch("pathlib.Path.exists", return_value=True):
            with pytest.raises(PluginInstallError, match="DB Error"):
                await plugin_install_use_case.execute(tenant_context, "hr-module")

    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=sample_plugin.id,
        status=PluginStatus.FAILED_DIRTY,
        error_log="DB Error",
    )
    mock_event_bus.publish_plugin_lifecycle.assert_called_once_with(
        action="failed",
        tenant_id=str(tenant_context.tenant_id),
        plugin_name="hr-module",
        plugin_version=sample_manifest.version,
        extra_data={"error": "DB Error"},
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

    # Provide malicious SQL with DROP TABLE (rơi vào denylist C4:
    # public./pg_/COPY/DO/TRIGGER/VIEW/RULE + DROP/DELETE/...)
    m_open = mock_open(read_data="DROP TABLE users;")
    with patch("builtins.open", m_open):
        with patch("pathlib.Path.exists", return_value=True):
            with pytest.raises(
                PluginInstallError, match="Seed file chứa từ khóa/kênh không được phép"
            ):
                await plugin_install_use_case.execute(tenant_context, "hr-module")

    # Advisory lock (1) + reset search_path TO public trong error handler (1)
    assert mock_session.execute.call_count == 2


# ─── Helpers dùng chung cho các test bổ sung ─────────────────────

_NO_SLEEP = patch("app.core.use_cases.plugin_install.asyncio.sleep", new=AsyncMock())


def _minimal_manifest(**overrides):
    data = {
        "name": "mini-plugin",
        "display_name": "Mini",
        "version": "1.2.0",
        "description": "t",
        "author": "t",
        "license": "MIT",
        "compatibility": {"proteus_os_min_version": "1.0.0"},
    }
    data.update(overrides)
    return PluginManifest(**data)


def _session_result(fetchone=None, fetchall=None):
    res = MagicMock()
    res.fetchone.return_value = fetchone
    res.fetchall.return_value = [] if fetchall is None else fetchall
    return res


def _setup_execute_basics(
    plugin_install_use_case, mock_plugin_repo, mock_manifest_parser, manifest
):
    """Repo/parse mặc định cho full execute() với manifest tối giản."""
    plugin = PluginEntity(
        id=uuid.uuid4(), code_name="mini-plugin", display_name="Mini", version="1.2.0"
    )
    mock_plugin_repo.get_by_code_name.return_value = plugin
    mock_plugin_repo.get_installation_status.return_value = None
    mock_manifest_parser.parse.return_value = manifest
    return plugin


def _patch_role_repo_empty():
    """RoleRepository.list_by_tenant → [] (tránh đụng SQLAlchemy model thật)."""
    rr_patcher = patch("app.core.use_cases.plugin_install.RoleRepository")
    rr_cls = rr_patcher.start()
    rr_cls.return_value.list_by_tenant = AsyncMock(return_value=[])
    return rr_patcher


# ─── 1. _validate_seed_statement: allowlist pass / denylist chặn ──

_FORBIDDEN_STMTS = [
    "DROP TABLE users;",
    "TRUNCATE TABLE t;",
    "DELETE FROM t;",
    "UPDATE t SET a = 1;",
    "ALTER TABLE t ADD COLUMN a INT;",
    "COPY t FROM '/tmp/x.csv';",
    "DO $$ BEGIN RAISE NOTICE 'x'; END $$;",
    "CREATE VIEW v AS SELECT 1;",
    "CREATE OR REPLACE VIEW v AS SELECT 1;",
    "CREATE TRIGGER trg AFTER INSERT ON t EXECUTE FUNCTION f();",
    "CREATE RULE r AS ON INSERT TO t DO NOTHING;",
    "CREATE FUNCTION f() RETURNS INT AS $$ SELECT 1 $$ LANGUAGE sql;",
    "SELECT * FROM public.users;",
    "SELECT * FROM pg_catalog.pg_tables;",
    "SELECT * FROM information_schema.columns;",
    "SELECT pg_read_file('/etc/passwd');",
    "GRANT SELECT ON t TO app_user;",
    "CREATE EXTENSION dblink;",
    "LISTEN mychan;",
    "VACUUM t;",
    "SELECT 1;",
]


def test_validate_seed_statement_policy():
    # Allowlist pass (CREATE TABLE / CREATE INDEX / INSERT, kể cả ';' cuối)
    for ok in [
        "CREATE TABLE t (id UUID PRIMARY KEY);",
        "  create unique index ix_t ON t (a)  ",
        "INSERT INTO t (id) VALUES ('x');",
        # Upsert chuẩn cho seed idempotent (mọi seed plugin đều dùng)
        "INSERT INTO t (id) VALUES ('x') ON CONFLICT (id) DO NOTHING;",
        # Từ khóa trong comment / data tiếng Việt không được tính
        "-- reset drop delete set\nCREATE TABLE t (id INT);",
        "INSERT INTO t (name) VALUES ('reset mật khẩu');",
        "/* search_path đã set sẵn */ INSERT INTO t (id) VALUES (1);",
    ]:
        _validate_seed_statement(ok)

    # Statement rỗng
    with pytest.raises(PluginInstallError, match="statement rỗng"):
        _validate_seed_statement("   ;  ")

    # Allowlist reject (không forbidden nhưng cũng không allowed: SELECT)
    with pytest.raises(PluginInstallError, match="chỉ cho phép"):
        _validate_seed_statement("SELECT 1")

    # Denylist chặn
    for bad in _FORBIDDEN_STMTS[:-1]:  # trừ SELECT 1 đã check allowlist ở trên
        with pytest.raises(
            PluginInstallError, match="từ khóa/kênh không được phép"
        ):
            _validate_seed_statement(bad)


# ─── 2. _split helpers: fallback (no sqlparse) + sqlparse path ───

_FALLBACK_SQL = """-- leading comment; with semicolon
CREATE TABLE t (id INT, name TEXT DEFAULT 'it''s; tricky');
/* block; comment spanning
   two lines */ INSERT INTO t (id) VALUES (1);
INSERT INTO t (id) VALUES ($$cost $5; ok$$);
INSERT INTO t (id) VALUES ($tag$va;lue$tag$);
CREATE INDEX "my;idx" ON t (id);
INSERT INTO t (id) VALUES ($1)"""


def test_split_seed_statements_fallback_without_sqlparse():
    with patch.dict(sys.modules, {"sqlparse": None}):
        stmts = _split_seed_statements_safe(_FALLBACK_SQL + ";")
    assert len(stmts) == 6
    assert stmts[0].startswith("-- leading comment; with semicolon")
    assert "it''s; tricky" in stmts[0]
    assert stmts[1].startswith("/* block; comment")
    assert "$$cost $5; ok$$" in stmts[2]
    assert "$tag$va;lue$tag$" in stmts[3]
    assert '"my;idx"' in stmts[4]
    assert stmts[5] == "INSERT INTO t (id) VALUES ($1)"

    # Tail không có ';' cuối vẫn được giữ
    with patch.dict(sys.modules, {"sqlparse": None}):
        tail = _split_seed_statements_safe("INSERT INTO t (id) VALUES (2)")
    assert tail == ["INSERT INTO t (id) VALUES (2)"]


def test_split_seed_statements_sqlparse_path():
    sqlparse = pytest.importorskip("sqlparse")
    assert sqlparse is not None
    stmts = _split_seed_statements_safe(
        "CREATE TABLE t (id INT); INSERT INTO t (id) VALUES (1);"
    )
    assert len(stmts) == 2


# ─── 3. Guard ACTIVE / UNINSTALLING ───────────────────────────────
# LƯU Ý: worker KHÔNG chặn INSTALLING — đó là marker do endpoint upsert
# trước khi queue task (chặn sẽ tự-deadlock mọi lượt cài, UI kẹt 95%).
# Chống double-install do endpoint đảm nhiệm (409 trước upsert).

@pytest.mark.asyncio
async def test_execute_guards_uninstalling(
    plugin_install_use_case, mock_plugin_repo, tenant_context, sample_plugin
):
    mock_plugin_repo.get_by_code_name.return_value = sample_plugin
    mock_plugin_repo.get_installation_status.return_value = (
        PluginStatus.UNINSTALLING
    )
    with pytest.raises(PluginInstallError, match="trong quá trình gỡ"):
        await plugin_install_use_case.execute(tenant_context, "hr-module")


@pytest.mark.asyncio
async def test_execute_installing_status_proceeds(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    tenant_context,
    sample_plugin,
):
    """INSTALLING (do endpoint upsert) phải đi tiếp, không tự chặn."""
    mock_plugin_repo.get_by_code_name.return_value = sample_plugin
    mock_plugin_repo.get_installation_status.return_value = PluginStatus.INSTALLING
    mock_manifest_parser.parse.side_effect = PluginInstallError("SENTINEL_PAST_GUARD")
    with pytest.raises(PluginInstallError, match="SENTINEL_PAST_GUARD"):
        await plugin_install_use_case.execute(tenant_context, "hr-module")


# ─── 4. Advisory lock best-effort fail vẫn cài thành công ─────────

@pytest.mark.asyncio
async def test_execute_advisory_lock_best_effort(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_session,
    tenant_context,
):
    manifest = _minimal_manifest()
    plugin = _setup_execute_basics(
        plugin_install_use_case, mock_plugin_repo, mock_manifest_parser, manifest
    )
    calls = {"n": 0}
    default = _session_result()

    def _route(stmt, *args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise Exception("lock unavailable")
        return default

    mock_session.execute.side_effect = _route
    rr_patcher = _patch_role_repo_empty()
    try:
        with _NO_SLEEP:
            await plugin_install_use_case.execute(tenant_context, "mini-plugin")
    finally:
        rr_patcher.stop()
    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=plugin.id,
        status=PluginStatus.ACTIVE,
    )


# ─── 5. Credentials flow (step 1.5) qua execute() ─────────────────

@pytest.mark.asyncio
async def test_execute_credentials_flow(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_mattermost_adapter,
    mock_session,
    tenant_context,
):
    manifest = _minimal_manifest(
        credentials_schema=[
            {"key": "api_key", "label": "API Key", "credential_type_name": "gmailOAuth2"}
        ]
    )
    plugin = _setup_execute_basics(
        plugin_install_use_case, mock_plugin_repo, mock_manifest_parser, manifest
    )
    plugin_install_use_case.n8n_adapter.create_credential = AsyncMock(
        return_value={"id": "cred-9"}
    )
    rr_patcher = _patch_role_repo_empty()
    try:
        with _NO_SLEEP:
            await plugin_install_use_case.execute(
                tenant_context,
                "mini-plugin",
                credentials=[CredentialInput(key="api_key", value="v")],
            )
    finally:
        rr_patcher.stop()
    mock_plugin_repo.update_credential_ids.assert_called_once_with(
        tenant_context.tenant_id, plugin.id, ["cred-9"]
    )
    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=plugin.id,
        status=PluginStatus.ACTIVE,
    )


@pytest.mark.asyncio
async def test_step_1_5_credentials_create_error(
    plugin_install_use_case, mock_n8n_adapter, tenant_context
):
    plugin_install_use_case.n8n_adapter.create_credential = AsyncMock(
        side_effect=Exception("n8n down")
    )
    manifest = _minimal_manifest(
        credentials_schema=[{"key": "k", "label": "K"}]
    )
    mapping, assets = await plugin_install_use_case._step_1_5_credentials(
        tenant_context, "mini-plugin", manifest, [CredentialInput(key="k", value="v")]
    )
    assert mapping == {} and assets == []


@pytest.mark.asyncio
async def test_step_2_n8n_skips_workflow_outside_plugins_dir(
    plugin_install_use_case,
    mock_manifest_parser,
    tenant_context,
    tmp_path,
):
    _write_wf(tmp_path, [{"type": "n8n-nodes-base.webhook", "parameters": {}}])
    mock_manifest_parser.plugins_dir = tmp_path
    manifest = _minimal_manifest(
        workflows=[{"file": "wf.json", "name": "wf", "trigger": "webhook"}]
    )
    with patch.object(Path, "is_relative_to", return_value=False):
        ids = await plugin_install_use_case._step_2_n8n(
            tenant_context, "hr-module", manifest
        )
    assert ids == []


@pytest.mark.asyncio
async def test_rollback_db_roles_error_best_effort(
    plugin_install_use_case, tenant_context
):
    assets = {
        "n8n": [], "metabase": [], "appsmith": [], "keycloak": [],
        "db_roles": ["hr_manager"], "events": [], "credentials": [],
    }
    with patch(
        "app.core.use_cases.plugin_install.RoleRepository",
        side_effect=Exception("db down"),
    ):
        await plugin_install_use_case._rollback(
            ["keycloak"], tenant_context, "mini-plugin",
            _minimal_manifest(), assets,
        )  # nuốt lỗi, không raise


@pytest.mark.asyncio
async def test_step_1_5_credentials_without_adapter_support(
    plugin_install_use_case, tenant_context
):
    plugin_install_use_case.n8n_adapter = object()
    manifest = _minimal_manifest(
        credentials_schema=[{"key": "k", "label": "K"}]
    )
    mapping, assets = await plugin_install_use_case._step_1_5_credentials(
        tenant_context, "mini-plugin", manifest, [CredentialInput(key="k", value="v")]
    )
    assert mapping == {} and assets == []


# ─── 6. _step_2_n8n: lookup found / create / error ────────────────

def _write_wf(tmp_path, nodes):
    import json

    plugindir = tmp_path / "hr-module"
    plugindir.mkdir(exist_ok=True)
    (plugindir / "wf.json").write_text(
        json.dumps({"nodes": nodes}), encoding="utf-8"
    )
    return plugindir


_N8N_NODES = [
    {"type": "n8n-nodes-base.webhook", "parameters": {}},
    {
        "type": "n8n-nodes-base.postgres",
        "parameters": {"query": "SELECT * FROM {{TENANT_SCHEMA}}.t"},
        "credentials": None,
    },
    {"type": "n8n-nodes-base.mattermost", "parameters": {}, "credentials": None},
    {
        "type": "@n8n/n8n-nodes-langchain.lmChatOllama",
        "parameters": {},
        "credentials": {"ollamaApi": {"id": "OllamaLocal"}},
    },
    {
        "type": "n8n-nodes-base.postgres",
        "parameters": {},
        "credentials": {"gmailOAuth2": {}},
    },
]


def _n8n_lookup_route(found):
    def _route(stmt, *args, **kwargs):
        sql = str(stmt)
        for key, val in found.items():
            if key in sql:
                return _session_result(fetchone=(val,))
        return _session_result()
    return _route


@pytest.mark.asyncio
async def test_step_2_n8n_found_credentials_and_injection(
    plugin_install_use_case,
    mock_manifest_parser,
    mock_n8n_adapter,
    mock_session,
    tenant_context,
    tmp_path,
):
    _write_wf(tmp_path, _N8N_NODES)
    mock_manifest_parser.plugins_dir = tmp_path
    mock_session.execute.side_effect = _n8n_lookup_route(
        {"ProteusDB_Real": "db-1", "ProteusMM": "mm-1", "ProteusOllama": "ol-1"}
    )
    mock_n8n_adapter.import_workflow = AsyncMock(return_value="wf-1")
    mock_n8n_adapter.activate_workflow = AsyncMock(
        side_effect=Exception("activate boom")
    )
    plugin_install_use_case.tenant_repo = AsyncMock()
    manifest = _minimal_manifest(
        workflows=[
            {"file": "wf.json", "name": "wf", "trigger": "webhook"},
            {"file": "../evil.json", "name": "bad", "trigger": "webhook"},
            {"file": "/abs.json", "name": "abs", "trigger": "webhook"},
            {"file": "missing.json", "name": "miss", "trigger": "webhook"},
        ]
    )
    with patch(
        "app.core.use_cases.tenant_onboarding.get_tenant_alerts_channel_id",
        new=AsyncMock(return_value="alerts-ch"),
    ):
        ids = await plugin_install_use_case._step_2_n8n(
            tenant_context,
            "hr-module",
            manifest,
            {"gmailOAuth2": "ext-9"},
            collected=[],
        )
    assert ids == ["wf-1"]
    mock_n8n_adapter.import_workflow.assert_awaited_once()
    wf_json = mock_n8n_adapter.import_workflow.await_args.args[0]
    nodes = wf_json["nodes"]
    by_type = {n["type"]: n for n in nodes}
    assert by_type["n8n-nodes-base.webhook"]["parameters"]["httpMethod"] == "POST"
    pg_query_node = next(
        n for n in nodes if "query" in n.get("parameters", {})
    )
    assert "tenant_" in pg_query_node["parameters"]["query"]
    assert "{{TENANT_SCHEMA}}" not in pg_query_node["parameters"]["query"]
    assert pg_query_node["credentials"]["postgres"]["id"] == "db-1"
    mm_node = [n for n in wf_json["nodes"] if "mattermost" in n["type"].lower()][0]
    assert mm_node["credentials"]["mattermostApi"]["id"] == "mm-1"
    assert mm_node["parameters"]["channelId"] == "alerts-ch"
    ol_node = [n for n in wf_json["nodes"] if "ollama" in n["type"].lower()][0]
    assert ol_node["credentials"]["ollamaApi"]["id"] == "ol-1"
    ext_node = [n for n in wf_json["nodes"] if "gmailOAuth2" in n.get("credentials", {})][
        0
    ]
    assert ext_node["credentials"]["gmailOAuth2"]["id"] == "ext-9"


@pytest.mark.asyncio
async def test_step_2_n8n_create_shared_credentials(
    plugin_install_use_case,
    mock_manifest_parser,
    mock_n8n_adapter,
    mock_session,
    tenant_context,
    tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    mock_session.execute.side_effect = lambda *a, **k: _session_result()
    mock_n8n_adapter.create_credential = AsyncMock(
        side_effect=[{"id": "new-mm"}, {"id": "new-ol"}]
    )
    manifest = _minimal_manifest()
    with (
        patch.object(
            __import__(
                "app.core.use_cases.plugin_install", fromlist=["settings"]
            ).settings,
            "MATTERMOST_BOT_TOKEN",
            "tok",
        ),
        _NO_SLEEP,
    ):
        ids = await plugin_install_use_case._step_2_n8n(
            tenant_context, "hr-module", manifest
        )
    assert ids == []
    assert mock_n8n_adapter.create_credential.await_count == 2


@pytest.mark.asyncio
async def test_step_2_n8n_credential_errors_best_effort(
    plugin_install_use_case,
    mock_manifest_parser,
    mock_n8n_adapter,
    mock_session,
    tenant_context,
    tmp_path,
):
    mock_manifest_parser.plugins_dir = tmp_path
    mock_session.execute.side_effect = lambda *a, **k: _session_result()
    mock_n8n_adapter.create_credential = AsyncMock(
        side_effect=Exception("n8n down")
    )
    plugin_install_use_case.tenant_repo = AsyncMock()
    manifest = _minimal_manifest()
    with (
        patch.object(
            __import__(
                "app.core.use_cases.plugin_install", fromlist=["settings"]
            ).settings,
            "MATTERMOST_BOT_TOKEN",
            "tok",
        ),
        patch(
            "app.core.use_cases.tenant_onboarding.get_tenant_alerts_channel_id",
            new=AsyncMock(side_effect=Exception("mm down")),
        ),
    ):
        ids = await plugin_install_use_case._step_2_n8n(
            tenant_context, "hr-module", manifest
        )
    assert ids == []


# ─── 7. _step_1_database: savepoint rollback + RLS ────────────────

@pytest.mark.asyncio
async def test_step_1_database_seed_savepoint_and_rls(
    plugin_install_use_case,
    mock_manifest_parser,
    mock_session,
    tenant_context,
    tmp_path,
):
    plugindir = tmp_path / "hr-module"
    plugindir.mkdir(exist_ok=True)
    (plugindir / "seed.sql").write_text(
        "CREATE TABLE test (id UUID PRIMARY KEY);\n"
        "INSERT INTO test (id) VALUES ('x');",
        encoding="utf-8",
    )
    mock_manifest_parser.plugins_dir = tmp_path
    manifest = _minimal_manifest(
        database={"tables": ["test", "test2"], "seed_file": "seed.sql"}
    )

    def _route(stmt, *args, **kwargs):
        sql = str(stmt)
        if sql.strip().upper().startswith("INSERT"):
            raise Exception("insert boom")
        if "CREATE ROLE app_user" in sql:
            raise Exception("role exists")
        if 'ON "test2"' in sql:
            raise Exception("policy boom")
        if "information_schema.columns" in sql:
            return _session_result(fetchall=[("test",), ("test2",)])
        return _session_result()

    mock_session.execute.side_effect = _route
    await plugin_install_use_case._step_1_database(
        tenant_context, "hr-module", manifest
    )
    executed = [str(c.args[0]) for c in mock_session.execute.call_args_list]
    assert any("ROLLBACK TO SAVEPOINT seed_stmt_1" in s for s in executed)
    assert any("ROLLBACK TO SAVEPOINT rls_role" in s for s in executed)
    assert any("CREATE POLICY tenant_isolation_policy" in s for s in executed)
    assert any("RELEASE SAVEPOINT rls_test" in s for s in executed)
    assert any("ROLLBACK TO SAVEPOINT rls_test2" in s for s in executed)


@pytest.mark.asyncio
async def test_step_1_database_rejects_bad_paths(
    plugin_install_use_case,
    mock_manifest_parser,
    mock_session,
    tenant_context,
    tmp_path,
):
    plugindir = tmp_path / "hr-module"
    plugindir.mkdir(exist_ok=True)
    (plugindir / "seed.sql").write_text("", encoding="utf-8")
    mock_manifest_parser.plugins_dir = tmp_path
    mock_session.execute.side_effect = lambda *a, **k: _session_result()

    with pytest.raises(PluginInstallError, match="Invalid plugin_code_name"):
        await plugin_install_use_case._step_1_database(
            tenant_context, "Bad_Code!", _minimal_manifest(
                database={"tables": [], "seed_file": "seed.sql"}
            )
        )
    with pytest.raises(PluginInstallError, match="Seed file path không hợp lệ"):
        await plugin_install_use_case._step_1_database(
            tenant_context, "hr-module", _minimal_manifest(
                database={"tables": [], "seed_file": "../evil.sql"}
            )
        )
    with patch.object(Path, "is_relative_to", return_value=False):
        with pytest.raises(PluginInstallError, match="vượt ngoài plugins_dir"):
            await plugin_install_use_case._step_1_database(
                tenant_context, "hr-module", _minimal_manifest(
                    database={"tables": [], "seed_file": "seed.sql"}
                )
            )
    with pytest.raises(PluginInstallError, match="rỗng hoặc không hợp lệ"):
        await plugin_install_use_case._step_1_database(
            tenant_context, "hr-module", _minimal_manifest(
                database={"tables": [], "seed_file": "seed.sql"}
            )
        )
    with pytest.raises(PluginInstallError, match="Invalid table name"):
        await plugin_install_use_case._step_1_database(
            tenant_context, "hr-module", _minimal_manifest(
                database={"tables": ["bad-table!"]}
            )
        )


# ─── 8. Version compatibility + steps log helpers ─────────────────

def test_check_version_compatibility(sample_manifest):
    uc = PluginInstallUseCase.__new__(PluginInstallUseCase)
    bad = sample_manifest.model_copy(
        update={
            "compatibility": ManifestCompatibility(proteus_os_min_version="99.0.0")
        }
    )
    with pytest.raises(PluginInstallError, match="yêu cầu Proteus OS"):
        uc._check_version_compatibility(bad)
    garbage = sample_manifest.model_copy(
        update={
            "compatibility": ManifestCompatibility(proteus_os_min_version="not-a-ver")
        }
    )
    uc._check_version_compatibility(garbage)  # warn-and-pass, không raise


@pytest.mark.asyncio
async def test_log_step_and_persist_steps_best_effort(
    plugin_install_use_case, mock_plugin_repo, mock_session, tenant_context,
    sample_plugin,
):
    uc = plugin_install_use_case
    uc._log_step("database", "RUNNING")
    uc._log_step("database", "DONE")
    assert len(uc._steps_log) == 1
    assert uc._steps_log[0]["status"] == "DONE"
    uc._log_step("n8n", "FAILED", "boom")
    assert uc._steps_log[-1] == {
        "step": "n8n",
        "status": "FAILED",
        "at": uc._steps_log[-1]["at"],
        "message": "boom",
    }

    await uc._persist_steps(tenant_context, sample_plugin.id)
    mock_plugin_repo.update_install_steps_log.assert_awaited()
    mock_session.commit.assert_awaited()

    mock_plugin_repo.update_install_steps_log.side_effect = Exception("db down")
    await uc._persist_steps(tenant_context, sample_plugin.id)  # nuốt lỗi, không raise


# ─── 9. Success best-effort: tenant + notify/event fail ───────────

@pytest.mark.asyncio
async def test_execute_success_best_effort_notifications(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_mattermost_adapter,
    mock_event_bus,
    tenant_context,
):
    manifest = _minimal_manifest()
    plugin = _setup_execute_basics(
        plugin_install_use_case, mock_plugin_repo, mock_manifest_parser, manifest
    )
    plugin_install_use_case.tenant_repo = AsyncMock()
    plugin_install_use_case.tenant_repo.get_by_id.return_value = types.SimpleNamespace(
        notify_channel_id="ch-9", keycloak_realm="r1"
    )
    mock_mattermost_adapter.send_message.side_effect = Exception("mm down")
    mock_event_bus.publish_plugin_lifecycle.side_effect = Exception("bus down")
    rr_patcher = _patch_role_repo_empty()
    try:
        with _NO_SLEEP:
            await plugin_install_use_case.execute(tenant_context, "mini-plugin")
    finally:
        rr_patcher.stop()
    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=plugin.id,
        status=PluginStatus.ACTIVE,
    )
    mock_mattermost_adapter.send_message.assert_called_once()
    mock_event_bus.publish_plugin_lifecycle.assert_called_once()


# ─── 10. Failure best-effort handlers ─────────────────────────────

@pytest.mark.asyncio
async def test_execute_failure_best_effort_handlers(
    plugin_install_use_case,
    mock_plugin_repo,
    mock_manifest_parser,
    mock_metabase_adapter,
    mock_mattermost_adapter,
    mock_event_bus,
    mock_session,
    tenant_context,
    tmp_path,
):
    plugindir = tmp_path / "mini-plugin"
    plugindir.mkdir(exist_ok=True)
    (plugindir / "db.json").write_text('{"d": 1}', encoding="utf-8")
    mock_manifest_parser.plugins_dir = tmp_path
    manifest = _minimal_manifest(
        dashboards=[{"file": "db.json", "name": "db"}]
    )
    plugin = _setup_execute_basics(
        plugin_install_use_case, mock_plugin_repo, mock_manifest_parser, manifest
    )
    mock_metabase_adapter.import_dashboard.side_effect = Exception("mb boom")
    mock_plugin_repo.update_install_steps_log.side_effect = Exception("log down")
    mock_mattermost_adapter.send_message.side_effect = Exception("mm down")
    mock_event_bus.publish_plugin_lifecycle.side_effect = Exception("bus down")
    plugin_install_use_case.tenant_repo = AsyncMock()
    plugin_install_use_case.tenant_repo.get_by_id.return_value = types.SimpleNamespace(
        notify_channel_id="ch-9", keycloak_realm="r1"
    )
    rr_patcher = _patch_role_repo_empty()
    try:
        with _NO_SLEEP, pytest.raises(PluginInstallError, match="mb boom"):
            await plugin_install_use_case.execute(tenant_context, "mini-plugin")
    finally:
        rr_patcher.stop()
    mock_plugin_repo.update_status.assert_called_once_with(
        tenant_id=tenant_context.tenant_id,
        plugin_id=plugin.id,
        status=PluginStatus.FAILED_DIRTY,
        error_log="mb boom",
    )


# ─── 11. Compensating rollback mọi nhánh ──────────────────────────

@pytest.mark.asyncio
async def test_rollback_all_branches(
    plugin_install_use_case,
    mock_n8n_adapter,
    mock_metabase_adapter,
    mock_appsmith_adapter,
    mock_keycloak_adapter,
    mock_session,
    tenant_context,
):
    uc = plugin_install_use_case
    uc.tenant_repo = AsyncMock()
    uc.tenant_repo.get_by_id.return_value = types.SimpleNamespace(
        notify_channel_id="ch-9", keycloak_realm="r1"
    )
    uc.tenant_repo.get_integration_by_provider = AsyncMock(
        return_value=types.SimpleNamespace(config={"url": "x"})
    )
    uc._credential_ids = [{"id": "c1", "name": "n1"}, {"id": "c2", "name": "n2"}]

    async def _del_cred(cid):
        if cid == "c2":
            raise Exception("cred gone")

    mock_n8n_adapter.delete_credential.side_effect = _del_cred
    mock_metabase_adapter.delete_dashboard.side_effect = Exception("mb gone")
    manifest = _minimal_manifest(database={"tables": ["t1", "bad-table!"]})
    assets = {
        "n8n": ["w1", "w2"],
        "metabase": ["d1"],
        "appsmith": ["a1"],
        "keycloak": ["mini-plugin_hr_manager"],
        "db_roles": ["hr_manager"],
        "events": ["e1"],
        "credentials": ["c1"],
    }
    rid = uuid.uuid4()
    with patch(
        "app.core.use_cases.plugin_install.RoleRepository"
    ) as rr_cls:
        rr_cls.return_value.list_by_tenant = AsyncMock(
            return_value=[types.SimpleNamespace(name="hr_manager", id=rid)]
        )
        rr_cls.return_value.delete_role = AsyncMock()
        await uc._rollback(
            ["credentials", "database", "n8n", "metabase", "appsmith", "keycloak", "events"],
            tenant_context,
            "mini-plugin",
            manifest,
            assets,
        )
        rr_cls.return_value.delete_role.assert_awaited_once_with(rid, tenant_context.tenant_id)

    assert mock_n8n_adapter.delete_workflow.await_count == 2
    mock_keycloak_adapter.delete_role.assert_awaited_once_with(
        realm="r1", role_name="mini-plugin_hr_manager"
    )
    mock_appsmith_adapter.delete_application.assert_awaited_once_with(
        "a1", integration_config={"url": "x"}
    )
    assert mock_n8n_adapter.delete_credential.await_count == 2
    executed = [str(c.args[0]) for c in mock_session.execute.call_args_list]
    assert any('DROP TABLE IF EXISTS "t1"' in s for s in executed)
    assert any("SET search_path TO public" in s for s in executed)


# ─── 12. _step_5_keycloak: skip trùng + lỗi best-effort ───────────

@pytest.mark.asyncio
async def test_step_5_keycloak_existing_and_error(
    plugin_install_use_case, mock_keycloak_adapter, tenant_context
):
    uc = plugin_install_use_case
    uc.tenant_repo = AsyncMock()
    uc.tenant_repo.get_by_id.return_value = types.SimpleNamespace(
        keycloak_realm="tenant-realm"
    )
    manifest = _minimal_manifest(
        roles=[
            {"name": "hr_manager", "display_name": "HR"},
            {"name": "hr_new", "display_name": "New"},
        ]
    )
    with patch(
        "app.core.use_cases.plugin_install.RoleRepository"
    ) as rr_cls:
        rr_cls.return_value.list_by_tenant = AsyncMock(
            return_value=[types.SimpleNamespace(name="hr_manager")]
        )
        rr_cls.return_value.create_role = AsyncMock()
        kc_roles, db_roles = await uc._step_5_keycloak(
            tenant_context, "mini-plugin", manifest
        )
    assert kc_roles == ["mini-plugin_hr_manager", "mini-plugin_hr_new"]
    assert db_roles == ["hr_new"]
    mock_keycloak_adapter.create_role.assert_awaited_with(
        realm="tenant-realm", role_name="mini-plugin_hr_new"
    )

    with patch(
        "app.core.use_cases.plugin_install.RoleRepository",
        side_effect=Exception("db down"),
    ):
        kc_roles, db_roles = await uc._step_5_keycloak(
            tenant_context, "mini-plugin", manifest
        )
    assert len(kc_roles) == 2 and db_roles == []


# ─── 13. _step_4_appsmith + _step_3_metabase file thiếu ───────────

@pytest.mark.asyncio
async def test_step_4_appsmith_with_integration(
    plugin_install_use_case,
    mock_manifest_parser,
    mock_appsmith_adapter,
    tenant_context,
    tmp_path,
):
    plugindir = tmp_path / "mini-plugin"
    plugindir.mkdir(exist_ok=True)
    (plugindir / "app.json").write_text('{"app": 1}', encoding="utf-8")
    mock_manifest_parser.plugins_dir = tmp_path
    plugin_install_use_case.tenant_repo = AsyncMock()
    plugin_install_use_case.tenant_repo.get_integration_by_provider = AsyncMock(
        return_value=types.SimpleNamespace(config={"url": "appsmith"})
    )
    mock_appsmith_adapter.import_application = AsyncMock(return_value="app-1")
    manifest = _minimal_manifest(ui={"appsmith_app": "app.json"})
    ids = await plugin_install_use_case._step_4_appsmith(
        tenant_context, "mini-plugin", manifest, collected=[]
    )
    assert ids == ["app-1"]
    mock_appsmith_adapter.import_application.assert_awaited_once()
    assert (
        mock_appsmith_adapter.import_application.await_args.kwargs[
            "integration_config"
        ]
        == {"url": "appsmith"}
    )


@pytest.mark.asyncio
async def test_step_3_metabase_skips_missing_file(
    plugin_install_use_case,
    mock_manifest_parser,
    mock_metabase_adapter,
    tenant_context,
    tmp_path,
):
    plugindir = tmp_path / "mini-plugin"
    plugindir.mkdir(exist_ok=True)
    (plugindir / "real.json").write_text('{"d": 1}', encoding="utf-8")
    mock_manifest_parser.plugins_dir = tmp_path
    mock_metabase_adapter.import_dashboard = AsyncMock(return_value="dash-1")
    manifest = _minimal_manifest(
        dashboards=[
            {"file": "missing.json", "name": "miss"},
            {"file": "real.json", "name": "real"},
        ]
    )
    ids = await plugin_install_use_case._step_3_metabase(
        tenant_context, "mini-plugin", manifest, collected=[]
    )
    assert ids == ["dash-1"]
    mock_metabase_adapter.import_dashboard.assert_awaited_once()

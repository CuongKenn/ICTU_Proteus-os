# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Coverage bổ sung cho SQLAlchemyPluginRepository (mock session, no DB)."""

import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
from app.core.domain.entities import PluginStatus


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.fixture
def repo(mock_session):
    return SQLAlchemyPluginRepository(mock_session)


def _res(*, scalar=None, first=None, all_rows=None, fetchone=None):
    r = MagicMock()
    r.scalar.return_value = scalar
    r.first.return_value = first
    if all_rows is not None:
        r.all.return_value = all_rows
    r.fetchone.return_value = fetchone
    return r


def _row(**kw):
    base = {
        "id": uuid.uuid4(),
        "code_name": "hr-module",
        "display_name": "HR",
        "version": "1.0.0",
    }
    base.update(kw)
    return base


@pytest.mark.asyncio
async def test_get_by_code_name_found(repo, mock_session):
    r = MagicMock()
    r.mappings().first.return_value = _row()
    mock_session.execute.return_value = r
    ent = await repo.get_by_code_name("hr-module")
    assert ent.code_name == "hr-module"


@pytest.mark.asyncio
async def test_get_by_code_name_missing(repo, mock_session):
    r = MagicMock()
    r.mappings().first.return_value = None
    mock_session.execute.return_value = r
    assert await repo.get_by_code_name("nope") is None


@pytest.mark.asyncio
async def test_install_status_by_task_id(repo, mock_session):
    pid = uuid.uuid4()
    mock_session.execute.return_value = _res(first=("ACTIVE", pid))
    assert await repo.get_installation_status_by_task_id(
        uuid.uuid4(), uuid.uuid4()
    ) == (PluginStatus.ACTIVE, pid)
    # string pid converted
    mock_session.execute.return_value = _res(first=("INSTALLING", str(pid)))
    st, out_pid = await repo.get_installation_status_by_task_id(
        uuid.uuid4(), uuid.uuid4()
    )
    assert st == PluginStatus.INSTALLING and out_pid == pid
    mock_session.execute.return_value = _res(first=None)
    assert (
        await repo.get_installation_status_by_task_id(uuid.uuid4(), uuid.uuid4())
        is None
    )


@pytest.mark.asyncio
async def test_set_and_get_upgrade_task(repo, mock_session):
    pid = uuid.uuid4()
    await repo.set_upgrade_task_id(uuid.uuid4(), pid, uuid.uuid4())
    await repo.set_upgrade_task_id(uuid.uuid4(), pid, None)
    assert mock_session.execute.call_count == 2
    mock_session.execute.return_value = _res(first=("UPGRADING", str(pid)))
    st, got = await repo.get_upgrade_status_by_task_id(uuid.uuid4(), uuid.uuid4())
    assert st == PluginStatus.UPGRADING and got == pid
    mock_session.execute.return_value = _res(first=None)
    assert await repo.get_upgrade_status_by_task_id(uuid.uuid4(), uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_migrations(repo, mock_session):
    mock_session.execute.return_value = _res(
        all_rows=[("1.0.0", "f.sql", "abc"), ("1.1.0", "g.sql", "def")]
    )
    out = await repo.list_applied_migrations(uuid.uuid4(), uuid.uuid4())
    assert out["1.0.0"] == {"filename": "f.sql", "checksum": "abc"}
    await repo.record_applied_migration(
        uuid.uuid4(), uuid.uuid4(), "2.0.0", "h.sql", "xyz"
    )
    assert mock_session.execute.call_count == 2


@pytest.mark.asyncio
async def test_config_roundtrip(repo, mock_session):
    await repo.update_config(uuid.uuid4(), uuid.uuid4(), {"k": 1})
    mock_session.execute.return_value = _res(fetchone=('{"k": 1}',))
    assert await repo.get_config(uuid.uuid4(), uuid.uuid4()) == {"k": 1}
    mock_session.execute.return_value = _res(fetchone=({"k": 2},))
    # tuple row holding dict
    assert await repo.get_config(uuid.uuid4(), uuid.uuid4()) == {"k": 2}
    mock_session.execute.return_value = _res(fetchone=None)
    assert await repo.get_config(uuid.uuid4(), uuid.uuid4()) == {}
    mock_session.execute.return_value = _res(fetchone=(None,))
    assert await repo.get_config(uuid.uuid4(), uuid.uuid4()) == {}


@pytest.mark.asyncio
async def test_dirty_and_status_by_code(repo, mock_session):
    r = MagicMock()
    r.mappings().all.return_value = [{"plugin_name": "hr-module"}]
    mock_session.execute.return_value = r
    assert await repo.get_dirty_installations_older_than(24) == [
        {"plugin_name": "hr-module"}
    ]
    mock_session.execute.return_value = _res(first=("ACTIVE",))
    assert (
        await repo.get_tenant_plugin_status_by_code("t", "hr-module")
        == PluginStatus.ACTIVE
    )
    mock_session.execute.return_value = _res(first=None)
    assert await repo.get_tenant_plugin_status_by_code("t", "x") is None


@pytest.mark.asyncio
async def test_installed_version_and_failed_dirty(repo, mock_session):
    mock_session.execute.return_value = _res(first=("1.2.3",))
    assert await repo.get_installed_version(uuid.uuid4(), uuid.uuid4()) == "1.2.3"
    mock_session.execute.return_value = _res(first=(None,))
    assert await repo.get_installed_version(uuid.uuid4(), uuid.uuid4()) is None
    mock_session.execute.return_value = _res(first=None)
    assert await repo.get_installed_version(uuid.uuid4(), uuid.uuid4()) is None
    t, p = uuid.uuid4(), uuid.uuid4()
    mock_session.execute.return_value = _res(all_rows=[(t, p, "hr-module")])
    assert await repo.get_failed_dirty_plugins() == [(t, p, "hr-module")]


@pytest.mark.asyncio
async def test_steps_log_and_credential_ids(repo, mock_session):
    steps = [{"step": "db", "status": "DONE"}]
    await repo.update_install_steps_log(uuid.uuid4(), uuid.uuid4(), steps)
    creds = [{"name": "c1"}]
    await repo.update_credential_ids(uuid.uuid4(), uuid.uuid4(), creds)
    mock_session.execute.return_value = _res(fetchone=([{"a": 1}],))
    assert await repo.get_install_steps_log(uuid.uuid4(), uuid.uuid4()) == [{"a": 1}]
    mock_session.execute.return_value = _res(fetchone=(json.dumps(steps),))
    assert await repo.get_install_steps_log(uuid.uuid4(), uuid.uuid4()) == steps
    mock_session.execute.return_value = _res(fetchone=None)
    assert await repo.get_install_steps_log(uuid.uuid4(), uuid.uuid4()) == []
    mock_session.execute.return_value = _res(fetchone=(creds,))
    assert await repo.get_credential_ids(uuid.uuid4(), uuid.uuid4()) == creds
    mock_session.execute.return_value = _res(fetchone=(json.dumps(creds),))
    assert await repo.get_credential_ids(uuid.uuid4(), uuid.uuid4()) == creds
    mock_session.execute.return_value = _res(fetchone=None)
    assert await repo.get_credential_ids(uuid.uuid4(), uuid.uuid4()) == []


@pytest.mark.asyncio
async def test_upsert_from_manifest(repo, mock_session):
    await repo.upsert_from_manifest(
        "hr-module", "HR", "desc", "1.0.0", "ICTU", "AGPL",
        "http://icon", "http://manifest", True,
    )
    assert mock_session.execute.call_count == 1


def test_to_entity_json_strings_and_bad_data():
    ent = SQLAlchemyPluginRepository._to_entity(
        _row(
            credentials_schema=json.dumps(
                [{"key": "k", "label": "L", "required": True, "secret": False,
                  "credential_type_name": None, "help_text": None}]
            ),
            tags=json.dumps(["hr"]),
            screenshots=json.dumps(["s.png"]),
            status="ACTIVE",
            installed_version="1.0.0",
        )
    )
    assert ent.status == PluginStatus.ACTIVE
    assert ent.tags == ["hr"] and ent.screenshots == ["s.png"]


def test_to_entity_invalid_json_falls_back():
    ent = SQLAlchemyPluginRepository._to_entity(
        _row(
            credentials_schema="not-json",
            tags="not-json",
            screenshots="not-json",
            status=None,
        )
    )
    assert ent.tags == [] and ent.screenshots == []
    assert ent.credentials_schema == []


def test_to_entity_skips_bad_credential():
    ent = SQLAlchemyPluginRepository._to_entity(
        _row(credentials_schema=[{"totally": "wrong", "shape": 1}, "str"])
    )
    assert ent.credentials_schema == []

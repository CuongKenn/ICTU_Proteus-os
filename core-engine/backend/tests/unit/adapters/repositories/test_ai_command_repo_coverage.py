# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Coverage bổ sung cho SQLAlchemyAICommandRepository (mock session, no DB)."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.adapters.repositories.ai_command_repo import (
    SQLAlchemyAICommandRepository,
    _parse_jsonb,
    _to_json_str,
)
from app.core.domain.entities import AICommandStatus


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.fixture
def repo(mock_session):
    return SQLAlchemyAICommandRepository(mock_session)


def _exec_result(*, scalar=None, mappings_all=None, mappings_first="__unset__", rowcount=0):
    res = MagicMock()
    res.scalar.return_value = scalar
    m = MagicMock()
    if mappings_all is not None:
        m.all.return_value = mappings_all
    if mappings_first != "__unset__":
        m.first.return_value = mappings_first
    res.mappings.return_value = m
    res.rowcount = rowcount
    return res


# ─── _to_json_str ─────────────────────────────────────────────────────────


def test_to_json_str_none():
    assert _to_json_str(None) is None


def test_to_json_str_passthrough():
    assert _to_json_str('{"a":1}') == '{"a":1}'


def test_to_json_str_dict():
    import json

    assert _to_json_str({"a": 1}) == json.dumps({"a": 1})


def test_to_json_str_fallback_str():
    assert _to_json_str({"d": uuid.uuid4()}) is not None


# ─── _parse_jsonb ─────────────────────────────────────────────────────────


def test_parse_jsonb_none_dict_list():
    assert _parse_jsonb(None) is None
    d = {"a": 1}
    assert _parse_jsonb(d) == d
    assert _parse_jsonb([1, 2]) == [1, 2]


def test_parse_jsonb_valid_string():
    assert _parse_jsonb('{"a": 1}') == {"a": 1}


def test_parse_jsonb_invalid_string():
    assert _parse_jsonb("not-json{{{") == "not-json{{{"
    assert _parse_jsonb(123) == 123


# ─── _sanitize_row / _normalize_row (sync, pure) ──────────────────────────


def test_sanitize_row_legacy_and_drop(repo):
    out = repo._sanitize_row(
        {
            "approved_by": "u1",
            "second_approver": "u2",
            "mattermost_msg_id": "m1",
            "session_id": "drop",
            "dsl_payload": "drop",
            "unknown_col": "drop",
            "action": "core.users.list",
            "parameters": {"a": 1},
        }
    )
    assert out["approved_by_user_id"] == "u1"
    assert out["second_approver_id"] == "u2"
    assert out["mattermost_message_id"] == "m1"
    assert "session_id" not in out and "dsl_payload" not in out
    assert "unknown_col" not in out
    assert out["dsl_version"] == "1.0"
    assert isinstance(out["parameters"], str)


def test_sanitize_row_keeps_dsl_version(repo):
    out = repo._sanitize_row({"action": "x", "dsl_version": "2.0"})
    assert out["dsl_version"] == "2.0"


def test_normalize_row_legacy_and_dsl_payload(repo):
    row = repo._normalize_row(
        {
            "id": "1",
            "approved_by": "u1",
            "parameters": None,
            "dsl_payload": '{"parameters": {"x": 5}}',
            "dry_run_result": '{"affected_count": 2}',
            "session_id": "s",
        }
    )
    assert row["approved_by_user_id"] == "u1"
    assert "approved_by" not in row
    assert row["parameters"] == {"x": 5}
    assert row["dry_run_result"] == {"affected_count": 2}
    assert "session_id" not in row and "dsl_payload" not in row


def test_normalize_row_new_wins_and_bad_payload(repo):
    row = repo._normalize_row(
        {
            "approved_by_user_id": "new",
            "approved_by": "old",
            "parameters": {"keep": True},
            "dsl_payload": "not-json",
        }
    )
    assert row["approved_by_user_id"] == "new"
    assert "approved_by" not in row
    assert row["parameters"] == {"keep": True}


def test_normalize_row_dsl_payload_dict(repo):
    row = repo._normalize_row(
        {"parameters": None, "dsl_payload": {"parameters": {"y": 1}}}
    )
    assert row["parameters"] == {"y": 1}


# ─── _resolve_user_id ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resolve_user_id_none(repo, mock_session):
    assert await repo._resolve_user_id(None) is None
    mock_session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_resolve_user_id_found(repo, mock_session):
    real = uuid.uuid4()
    mock_session.execute.return_value = _exec_result(scalar=real)
    assert await repo._resolve_user_id("kc-id") == real


@pytest.mark.asyncio
async def test_resolve_user_id_not_found_returns_uid(repo, mock_session):
    mock_session.execute.return_value = _exec_result(scalar=None)
    assert await repo._resolve_user_id("kc-id") == "kc-id"


# ─── read paths ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_pending_expiring_soon(repo, mock_session):
    rows = [{"id": "a"}, {"id": "b"}]
    mock_session.execute.return_value = _exec_result(mappings_all=rows)
    out = await repo.get_pending_commands_expiring_soon(10)
    assert out == rows


@pytest.mark.asyncio
async def test_get_expired_pending(repo, mock_session):
    mock_session.execute.return_value = _exec_result(mappings_all=[{"id": "x"}])
    assert await repo.get_expired_pending_commands() == [{"id": "x"}]


@pytest.mark.asyncio
async def test_count_failed_since(repo, mock_session):
    mock_session.execute.return_value = _exec_result(scalar=3)
    assert await repo.count_failed_since(60) == 3
    mock_session.execute.return_value = _exec_result(scalar=None)
    assert await repo.count_failed_since(60) == 0


@pytest.mark.asyncio
async def test_get_pending_older_than(repo, mock_session):
    mock_session.execute.return_value = _exec_result(mappings_all=[{"id": "z"}])
    assert await repo.get_pending_older_than(30, limit=5) == [{"id": "z"}]


@pytest.mark.asyncio
async def test_update_status(repo, mock_session):
    mock_session.execute.return_value = _exec_result()
    await repo.update_status(uuid.uuid4(), AICommandStatus.APPROVED)
    assert mock_session.execute.call_count == 1


@pytest.mark.asyncio
async def test_get_command_by_id_found_and_missing(repo, mock_session):
    full = {
        "id": "1",
        "parameters": '{"a": 1}',
        "dry_run_result": None,
    }
    mock_session.execute.return_value = _exec_result(mappings_first=full)
    row = await repo.get_command_by_id(uuid.uuid4())
    assert row["parameters"] == {"a": 1}
    mock_session.execute.return_value = _exec_result(mappings_first=None)
    assert await repo.get_command_by_id(uuid.uuid4(), for_update=True) is None


# ─── update_command_approval ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_approval_noop(repo, mock_session):
    assert await repo.update_command_approval(uuid.uuid4()) == 0
    mock_session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_update_approval_deprecated_alias(repo, mock_session):
    mock_session.execute.return_value = _exec_result(rowcount=1)
    n = await repo.update_command_approval(
        uuid.uuid4(), approved_by="a", second_approver="b"
    )
    assert n == 1
    _, params = mock_session.execute.call_args[0][0], mock_session.execute.call_args[0][1]
    assert params["approved_by_user_id"] == "a"
    assert params["second_approver_id"] == "b"


@pytest.mark.asyncio
async def test_update_approval_approved_sets_approved_at(repo, mock_session):
    mock_session.execute.return_value = _exec_result(rowcount=1)
    n = await repo.update_command_approval(
        uuid.uuid4(),
        status="APPROVED",
        approved_by_user_id="u",
        mattermost_message_id="m",
    )
    assert n == 1
    sql = str(mock_session.execute.call_args[0][0])
    assert "approved_at" in sql


# ─── create_command ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_command_insert_ok(repo, mock_session):
    new_id = uuid.uuid4()
    mock_session.execute.side_effect = [
        _exec_result(scalar=uuid.uuid4()),  # resolve issued_by
        _exec_result(scalar=new_id),  # insert RETURNING
    ]
    out = await repo.create_command(
        {
            "id": new_id,
            "action": "core.users.list",
            "issued_by_user_id": "kc-1",
            "parameters": {"a": 1},
        }
    )
    assert out == new_id


@pytest.mark.asyncio
async def test_create_command_conflict_returns_id(repo, mock_session):
    cmd_id = uuid.uuid4()
    mock_session.execute.return_value = _exec_result(scalar=None)
    out = await repo.create_command({"id": cmd_id, "action": "x"})
    assert out == cmd_id


@pytest.mark.asyncio
async def test_create_command_resolves_approvers(repo, mock_session):
    cmd_id = uuid.uuid4()
    mock_session.execute.side_effect = [
        _exec_result(scalar="real-1"),
        _exec_result(scalar="real-2"),
        _exec_result(scalar=cmd_id),
    ]
    out = await repo.create_command(
        {
            "id": cmd_id,
            "action": "x",
            "approved_by_user_id": "kc-a",
            "second_approver_id": "kc-b",
        }
    )
    assert out == cmd_id
    assert mock_session.execute.call_count == 3


@pytest.mark.asyncio
async def test_commit_rollback(repo, mock_session):
    await repo.commit()
    await repo.rollback()
    mock_session.commit.assert_awaited_once()
    mock_session.rollback.assert_awaited_once()

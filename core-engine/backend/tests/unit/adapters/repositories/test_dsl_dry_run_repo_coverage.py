# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Coverage bổ sung cho DSL dry-run repo (validation + execute, mock session)."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.adapters.repositories.dsl_dry_run_repo import (
    SQLAlchemyDSLDryRunRepository,
    _try_manifest_allowlist,
    _validate_schema_name,
    _validate_table_name,
)


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.fixture
def repo(mock_session):
    return SQLAlchemyDSLDryRunRepository(mock_session)


def _res(*, scalar=None, fetchall=None):
    r = MagicMock()
    r.scalar.return_value = scalar
    if fetchall is not None:
        r.fetchall.return_value = fetchall
    return r


# ─── _validate_schema_name ────────────────────────────────────────────────


def test_schema_valid():
    assert _validate_schema_name("tenant_abc123") == "tenant_abc123"


@pytest.mark.parametrize("bad", ["", "a" * 64, "has-dash!", "semi;colon", "quo'te"])
def test_schema_invalid(bad):
    with pytest.raises(ValueError):
        _validate_schema_name(bad)


# ─── _validate_table_name ─────────────────────────────────────────────────


def test_table_simple_valid():
    assert _validate_table_name("leave_requests") == "leave_requests"


def test_table_schema_prefix_returns_last():
    assert _validate_table_name("public.leave_requests") == "leave_requests"


@pytest.mark.parametrize(
    "bad",
    [
        "",
        "   ",
        None,
        123,
        "a" * 129,
        "a..b",
        "a/b",
        "a\\b",
        "a;b",
        "a--b",
        "a'b",
        'a"b',
        "a`b",
        "a b",
        "a\tb",
        "a\nb",
        "a.b.c",
        ".b",
        "a.",
        "AUpper",
        "9start",
        "a" * 64 + ".b",
    ],
)
def test_table_invalid(bad):
    with pytest.raises(ValueError):
        _validate_table_name(bad)


def test_table_part_too_long():
    with pytest.raises(ValueError):
        _validate_table_name("a" * 64)


# ─── _try_manifest_allowlist ──────────────────────────────────────────────


def test_allowlist_none_on_parser_error():
    with patch(
        "app.adapters.external.local_manifest_parser.LocalManifestParser",
        side_effect=RuntimeError("nope"),
    ):
        assert _try_manifest_allowlist("t") is None


def test_allowlist_true_false(tmp_path):
    from types import SimpleNamespace

    class FakeParser:
        plugins_dir = tmp_path

        def parse(self, name):
            if name == "bad":
                raise ValueError("broken")
            return SimpleNamespace(
                database=SimpleNamespace(tables=["leave_requests"])
            )

    (tmp_path / "good").mkdir()
    (tmp_path / "good" / "manifest.yaml").write_text("x")
    (tmp_path / "bad").mkdir()
    (tmp_path / "bad" / "manifest.yaml").write_text("x")
    with patch(
        "app.adapters.external.local_manifest_parser.LocalManifestParser",
        FakeParser,
    ):
        assert _try_manifest_allowlist("leave_requests") is True
        assert _try_manifest_allowlist("other_table") is False


def test_allowlist_none_when_no_manifests(tmp_path):
    class FakeParser:
        plugins_dir = tmp_path

    with patch(
        "app.adapters.external.local_manifest_parser.LocalManifestParser",
        FakeParser,
    ):
        assert _try_manifest_allowlist("t") is None


# ─── execute_dry_run ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_execute_invalid_tenant(repo):
    with pytest.raises(ValueError):
        await repo.execute_dry_run("not-a-uuid", "leave_requests")


@pytest.mark.asyncio
async def test_execute_invalid_table(repo):
    with pytest.raises(ValueError):
        await repo.execute_dry_run(str(uuid.uuid4()), "../secret")


@pytest.mark.asyncio
async def test_execute_blocked_by_allowlist(repo):
    with patch(
        "app.adapters.repositories.dsl_dry_run_repo._try_manifest_allowlist",
        return_value=False,
    ):
        out = await repo.execute_dry_run(str(uuid.uuid4()), "leave_requests")
    assert out == {"affected_count": 0, "preview": []}


@pytest.mark.asyncio
async def test_execute_table_missing(repo, mock_session):
    mock_session.execute.return_value = _res(scalar=False)
    with patch(
        "app.adapters.repositories.dsl_dry_run_repo._try_manifest_allowlist",
        return_value=None,
    ):
        out = await repo.execute_dry_run(str(uuid.uuid4()), "leave_requests")
    assert out == {"affected_count": 0, "preview": []}


@pytest.mark.asyncio
async def test_execute_zero_count(repo, mock_session):
    mock_session.execute.side_effect = [
        _res(scalar=True),  # table exists
        _res(fetchall=[("tenant_id",), ("status",)]),  # columns
        _res(scalar=0),  # count
    ]
    with patch(
        "app.adapters.repositories.dsl_dry_run_repo._try_manifest_allowlist",
        return_value=True,
    ):
        out = await repo.execute_dry_run(str(uuid.uuid4()), "leave_requests")
    assert out == {"affected_count": 0, "preview": []}
    # where clause binds tenant_id (columns include tenant_id + status)
    count_params = mock_session.execute.call_args_list[2][0][1]
    assert count_params["tenant_id"] is not None


@pytest.mark.asyncio
async def test_execute_success_with_preview(repo, mock_session):
    import datetime

    tid = str(uuid.uuid4())
    preview_res = MagicMock()
    preview_res.keys.return_value = ["id", "created_at"]
    preview_res.fetchall.return_value = [
        ("r1", datetime.datetime(2026, 1, 1, 12, 0, 0)),
        ("r2", "plain"),
    ]
    mock_session.execute.side_effect = [
        _res(scalar=True),
        _res(fetchall=[("id",), ("created_at",)]),
        _res(scalar=2),
        preview_res,
    ]
    with patch(
        "app.adapters.repositories.dsl_dry_run_repo._try_manifest_allowlist",
        return_value=True,
    ):
        out = await repo.execute_dry_run(tid, "leave_requests")
    assert out["affected_count"] == 2
    assert len(out["preview"]) == 2
    assert out["preview"][0]["created_at"] == "2026-01-01T12:00:00"
    assert out["preview"][1]["created_at"] == "plain"

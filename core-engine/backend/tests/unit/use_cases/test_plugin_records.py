# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Unit tests cho Generic Plugin Records CRUD (per-tenant schema)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.domain.entities import PluginStatus, TenantContext
from app.core.domain.exceptions import (
    DSLInvalidActionError,
    DSLInvalidParametersError,
    DSLPluginNotActiveError,
    InsufficientPermissionsError,
    PluginNotFoundError,
)
from app.core.use_cases.plugin_records import PluginRecordsUseCase


def _result(*, all_rows=None, first_row=None, scalar_val=None, rowcount=1):
    r = MagicMock()
    r.all.return_value = all_rows or []
    m = MagicMock()
    m.all.return_value = all_rows or []
    m.first.return_value = first_row
    r.mappings.return_value = m
    r.scalar.return_value = scalar_val
    r.rowcount = rowcount
    return r


@pytest.fixture
def ctx():
    return TenantContext(
        tenant_id=uuid.uuid4(), user_id=uuid.uuid4(), roles=["asset_user"]
    )


def _make_uc(tables, session_results, installed=PluginStatus.ACTIVE, perms=None):
    parser = MagicMock()
    parser.parse.return_value = SimpleNamespace(
        database=SimpleNamespace(tables=tables)
    )
    repo = AsyncMock()
    repo.get_by_code_name.return_value = SimpleNamespace(id=uuid.uuid4())
    repo.get_installation_status.return_value = installed
    role_repo = AsyncMock()
    role_repo.get_user_permissions.return_value = (
        perms if perms is not None else ["asset:items:read"]
    )
    session = AsyncMock()
    session.execute.side_effect = session_results
    uc = PluginRecordsUseCase(
        plugin_repo=repo,
        manifest_parser=parser,
        role_repo=role_repo,
        session=session,
    )
    return uc, session


def _col_rows(*names):
    types = {
        "purchase_date": "date",
        "id": "uuid",
        "created_at": "timestamp with time zone",
    }
    return _result(all_rows=[(n, types.get(n, "character varying")) for n in names])


async def test_list_schema_qualified(ctx):
    cols = _col_rows("id", "code", "created_at")
    count = _result(scalar_val=2)
    rows = _result(
        all_rows=[{"id": "a", "code": "X"}, {"id": "b", "code": "Y"}]
    )
    uc, session = _make_uc(["asset_items"], [cols, count, rows])
    out = await uc.list_records(ctx, "asset-module", "asset_items")
    assert out["total"] == 2
    assert len(out["rows"]) == 2
    sql_texts = [str(c.args[0]) for c in session.execute.call_args_list]
    # information_schema phải scope theo schema tenant, không phải public.
    assert any("table_schema" in s for s in sql_texts)
    assert not any("table_schema = 'public'" in s for s in sql_texts)
    # Bảng phải qualify "tenant_*"."asset_items".
    schema = f"tenant_{ctx.tenant_id}".replace("-", "_")
    assert any(f'"{schema}"."asset_items"' in s for s in sql_texts)
    # Không còn lọc tenant_id (isolation = schema).
    assert not any("tenant_id" in s for s in sql_texts)


async def test_list_unknown_table(ctx):
    uc, _ = _make_uc(["asset_items"], [])
    with pytest.raises(DSLInvalidActionError):
        await uc.list_records(ctx, "asset-module", "users")


async def test_list_missing_table_in_schema(ctx):
    uc, _ = _make_uc(["asset_items"], [_result(all_rows=[])])
    with pytest.raises(PluginNotFoundError):
        await uc.list_records(ctx, "asset-module", "asset_items")


async def test_list_not_installed(ctx):
    uc, _ = _make_uc(["asset_items"], [], installed=None)
    with pytest.raises(DSLPluginNotActiveError):
        await uc.list_records(ctx, "asset-module", "asset_items")


async def test_list_forbidden(ctx):
    uc, _ = _make_uc(["asset_items"], [], perms=["hr:employees:read"])
    with pytest.raises(InsufficientPermissionsError):
        await uc.list_records(ctx, "asset-module", "asset_items")


async def test_create_strips_unknown_cols(ctx):
    cols = _col_rows("id", "code", "name", "purchase_date")
    created = _result(first_row={"id": "n", "code": "X", "name": "Y"})
    uc, session = _make_uc(["asset_items"], [cols, created])
    out = await uc.create_record(
        ctx, "asset-module", "asset_items",
        {"code": "X", "name": "Y", "purchase_date": "2026-09-11", "hacker": "DROP TABLE"},
    )
    assert out["code"] == "X"
    insert_sql = str(session.execute.call_args_list[1].args[0])
    assert "hacker" not in insert_sql
    assert '"asset_items"' in insert_sql
    params = session.execute.call_args_list[1].args[1]
    import datetime

    assert params["purchase_date"] == datetime.date(2026, 9, 11)


async def test_create_bad_date_400(ctx):
    cols = _col_rows("id", "purchase_date")
    uc, _ = _make_uc(["asset_items"], [cols])
    with pytest.raises(DSLInvalidParametersError):
        await uc.create_record(
            ctx, "asset-module", "asset_items", {"purchase_date": "not-a-date"}
        )


async def test_create_empty_body(ctx):
    uc, _ = _make_uc(["asset_items"], [])
    with pytest.raises(DSLInvalidParametersError):
        await uc.create_record(ctx, "asset-module", "asset_items", {})


async def test_update_ok_and_ignores_id(ctx):
    rid = str(uuid.uuid4())
    cols = _col_rows("id", "name")
    updated = _result(first_row={"id": rid, "name": "New"})
    uc, _ = _make_uc(["asset_items"], [cols, updated])
    out = await uc.update_record(
        ctx, "asset-module", "asset_items", rid,
        {"id": "forged", "name": "New"},
    )
    assert out["name"] == "New"


async def test_update_missing_row(ctx):
    cols = _col_rows("id", "name")
    updated = _result(first_row=None)
    uc, _ = _make_uc(["asset_items"], [cols, updated])
    with pytest.raises(PluginNotFoundError):
        await uc.update_record(
            ctx, "asset-module", "asset_items", str(uuid.uuid4()), {"name": "x"}
        )


async def test_update_bad_uuid(ctx):
    uc, _ = _make_uc(["asset_items"], [])
    with pytest.raises(DSLInvalidParametersError):
        await uc.update_record(
            ctx, "asset-module", "asset_items", "not-a-uuid", {"name": "x"}
        )


async def test_delete_ok(ctx):
    cols = _col_rows("id")
    deleted = _result(rowcount=1)
    uc, _ = _make_uc(["asset_items"], [cols, deleted])
    await uc.delete_record(ctx, "asset-module", "asset_items", str(uuid.uuid4()))


async def test_delete_missing_row(ctx):
    cols = _col_rows("id")
    deleted = _result(rowcount=0)
    uc, _ = _make_uc(["asset_items"], [cols, deleted])
    with pytest.raises(PluginNotFoundError):
        await uc.delete_record(
            ctx, "asset-module", "asset_items", str(uuid.uuid4())
        )

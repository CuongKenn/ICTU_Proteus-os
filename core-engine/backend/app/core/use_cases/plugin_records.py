# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Use Case — Generic Plugin Records CRUD
#
# Đọc/ghi trực tiếp các bảng dữ liệu của plugin qua MỘT nhóm endpoint duy nhất:
#   GET/POST /api/v1/plugins/{code}/records/{table}
#   PATCH/DELETE /api/v1/plugins/{code}/records/{table}/{id}
# Core không biết gì về asset hay CRM: tên bảng phải nằm trong
# manifest.yaml `database.tables` (allowlist), tên cột lấy từ
# information_schema (DB truth) nên không thể SQL-injection qua key.
#
# Phân vai rõ với dispatcher (plugin_action.py):
# - Quy trình có orchestration (duyệt → gán → nhắn tin) → n8n webhook.
# - CRUD hàng đơn lẻ không có workflow → endpoint này.
# Tenant isolation: mỗi tenant có schema riêng (tenant_<uuid>, do install tạo).
# Mọi query qualify "schema"."bảng" — KHÔNG dùng cột tenant_id (schema đã cách ly).
# Công thức schema phải khớp _step_1_database trong plugin_install.py.

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractPluginRepository
from app.adapters.repositories.role_repo import RoleRepository
from app.core.domain.entities import PluginStatus, TenantContext
from app.core.domain.exceptions import (
    DSLInvalidActionError,
    DSLInvalidParametersError,
    DSLPluginNotActiveError,
    InsufficientPermissionsError,
    PluginNotFoundError,
)
from app.core.domain.permissions import has_admin_role, has_wildcard_permission
from app.core.domain.ports import AbstractManifestParserPort

logger = logging.getLogger(__name__)

_CODE_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_TABLE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
_SCHEMA_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")
_MAX_LIMIT = 100
_UNSET = object()


def _jsonable(value: Any) -> Any:
    """Chuẩn hóa row DB thành JSON-serializable (datetime/UUID/Decimal…)."""
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


class PluginRecordsUseCase:
    """CRUD generic cho bảng dữ liệu plugin (allowlist từ manifest)."""

    def __init__(
        self,
        plugin_repo: AbstractPluginRepository,
        manifest_parser: AbstractManifestParserPort,
        role_repo: RoleRepository,
        session: AsyncSession,
    ) -> None:
        self.plugin_repo = plugin_repo
        self.manifest_parser = manifest_parser
        self.role_repo = role_repo
        self.session = session

    # ─── Guards ───────────────────────────────────────────────

    async def _resolve_table(self, plugin_code: str, table: str) -> None:
        if not _CODE_PATTERN.match(plugin_code):
            raise PluginNotFoundError(f"Plugin '{plugin_code}' không tồn tại.")
        if not _TABLE_PATTERN.match(table):
            raise DSLInvalidActionError(f"Bảng '{table}' không hợp lệ.")
        from app.adapters.external.local_manifest_parser import ManifestParserError

        try:
            manifest = self.manifest_parser.parse(plugin_code)
        except ManifestParserError as exc:
            raise PluginNotFoundError(
                f"Plugin '{plugin_code}' không tồn tại."
            ) from exc
        allowed = manifest.database.tables if manifest.database else []
        if table not in allowed:
            raise DSLInvalidActionError(
                f"Bảng '{table}' không thuộc plugin '{plugin_code}'."
            )

    async def _require_active(self, ctx: TenantContext, plugin_code: str) -> None:
        plugin = await self.plugin_repo.get_by_code_name(plugin_code)
        if not plugin:
            raise PluginNotFoundError(f"Plugin '{plugin_code}' không tồn tại.")
        status = await self.plugin_repo.get_installation_status(
            ctx.tenant_id, plugin.id
        )
        if status != PluginStatus.ACTIVE:
            raise DSLPluginNotActiveError(
                f"Plugin '{plugin_code}' chưa ACTIVE (hiện tại: {status})."
            )

    async def _require_prefix_perm(self, ctx: TenantContext, plugin_code: str) -> None:
        if has_admin_role(ctx.roles):
            return
        prefix = plugin_code.split("-")[0] + ":"
        perms = await self.role_repo.get_user_permissions(ctx.user_id)
        if has_wildcard_permission(perms):
            return
        if not any(p.startswith(prefix) for p in perms):
            raise InsufficientPermissionsError(
                f"Cần quyền nhóm '{prefix}*' để truy cập dữ liệu plugin."
            )

    async def _columns(self, schema: str, table: str) -> dict[str, str]:
        """Map cột → data_type (dùng để coerce kiểu cho asyncpg)."""
        res = await self.session.execute(
            text(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_schema = :s AND table_name = :t"
            ),
            {"s": schema, "t": table},
        )
        cols = {r[0]: r[1] for r in res.all()}
        if not cols:
            # Manifest cho phép nhưng bảng chưa tồn tại trong schema tenant
            # (install chưa chạy xong hoặc seed thiếu CREATE TABLE).
            raise PluginNotFoundError(
                f"Bảng '{table}' chưa tồn tại — plugin có thể chưa cài xong."
            )
        return cols

    @staticmethod
    def _coerce(col_type: str, col: str, value: Any) -> Any:
        """
        Ép kiểu Python cho asyncpg (nghiêm hơn psycopg2: không nhận str
        cho cột date/uuid). Sai định dạng → 400 rõ ràng thay vì 500.
        """
        if value is None:
            return None
        try:
            if col_type == "date" and isinstance(value, str):
                return date.fromisoformat(value.strip()[:10])
            if col_type in (
                "timestamp with time zone",
                "timestamp without time zone",
            ):
                if isinstance(value, str):
                    return datetime.fromisoformat(
                        value.strip().replace("Z", "+00:00")
                    )
                return value
            if col_type == "uuid" and isinstance(value, str):
                return uuid.UUID(value.strip())
            if col_type in ("numeric", "decimal") and isinstance(value, str):
                return Decimal(value.strip())
            if col_type in ("integer", "bigint", "smallint") and isinstance(
                value, str
            ):
                return int(value.strip())
            if col_type in ("json", "jsonb") and isinstance(value, (dict, list)):
                return json.dumps(value, ensure_ascii=False)
        except (ValueError, InvalidOperation) as exc:
            raise DSLInvalidParametersError(
                f"Giá trị cột '{col}' không đúng định dạng ({col_type})."
            ) from exc
        return value

    def _coerce_params(
        self, col_types: dict[str, str], data: dict[str, Any]
    ) -> dict[str, Any]:
        return {
            c: self._coerce(col_types[c], c, data[c])
            for c in data
            if c in col_types
        }

    @staticmethod
    def _schema(ctx: TenantContext) -> str:
        schema = f"tenant_{ctx.tenant_id}".replace("-", "_")
        if not _SCHEMA_PATTERN.match(schema):
            raise DSLInvalidParametersError("Tenant schema không hợp lệ.")
        return schema

    @staticmethod
    def _qt(schema: str, table: str) -> str:
        """Qualified table — cả 2 đều đã qua allowlist/regex nên an toàn."""
        return f'"{schema}"."{table}"'

    # ─── Public API ───────────────────────────────────────────

    async def list_records(
        self,
        ctx: TenantContext,
        plugin_code: str,
        table: str,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        await self._resolve_table(plugin_code, table)
        await self._require_active(ctx, plugin_code)
        await self._require_prefix_perm(ctx, plugin_code)

        limit = max(1, min(limit, _MAX_LIMIT))
        offset = max(0, offset)
        schema = self._schema(ctx)
        qt = self._qt(schema, table)
        cols = await self._columns(schema, table)  # validate bảng tồn tại
        order = "ORDER BY created_at DESC " if "created_at" in cols else ""

        total_res = await self.session.execute(
            text(f"SELECT COUNT(*) FROM {qt}"),
        )
        total = total_res.scalar() or 0

        rows_res = await self.session.execute(
            text(f"SELECT * FROM {qt} {order}LIMIT :lim OFFSET :off"),
            {"lim": limit, "off": offset},
        )
        rows = [_jsonable(dict(r)) for r in rows_res.mappings().all()]
        return {"rows": rows, "total": total}

    async def create_record(
        self,
        ctx: TenantContext,
        plugin_code: str,
        table: str,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        await self._resolve_table(plugin_code, table)
        await self._require_active(ctx, plugin_code)
        await self._require_prefix_perm(ctx, plugin_code)
        if not isinstance(data, dict) or not data:
            raise DSLInvalidParametersError("Body phải là JSON object không rỗng.")

        col_types = await self._columns(self._schema(ctx), table)
        params = self._coerce_params(col_types, data)
        # Một số plugin đời đầu (VD hr-module) vẫn giữ cột tenant_id NOT NULL —
        # server tự gắn, client không được gửi (chống giả mạo tenant).
        if "tenant_id" in col_types and "tenant_id" not in params:
            params["tenant_id"] = self._coerce(
                col_types["tenant_id"], "tenant_id", str(ctx.tenant_id)
            )
        if not params:
            raise DSLInvalidParametersError("Không có cột nào hợp lệ để ghi.")

        col_sql = ", ".join(params)
        val_sql = ", ".join(f":{c}" for c in params)
        qt = self._qt(self._schema(ctx), table)
        res = await self.session.execute(
            text(f"INSERT INTO {qt} ({col_sql}) VALUES ({val_sql}) RETURNING *"),
            params,
        )
        row = res.mappings().first()
        return _jsonable(dict(row)) if row else {}

    async def update_record(
        self,
        ctx: TenantContext,
        plugin_code: str,
        table: str,
        record_id: str,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        await self._resolve_table(plugin_code, table)
        await self._require_active(ctx, plugin_code)
        await self._require_prefix_perm(ctx, plugin_code)
        try:
            uuid.UUID(str(record_id))
        except ValueError as exc:
            raise DSLInvalidParametersError("record id phải là UUID.") from exc
        if not isinstance(data, dict) or not data:
            raise DSLInvalidParametersError("Body phải là JSON object không rỗng.")

        col_types = await self._columns(self._schema(ctx), table)
        body = {c: v for c, v in data.items() if c not in ("id", "tenant_id")}
        coerced = self._coerce_params(col_types, body)
        allowed = list(coerced)
        if not allowed:
            raise DSLInvalidParametersError("Không có cột nào hợp lệ để cập nhật.")
        set_sql = ", ".join(f"{c} = :{c}" for c in allowed)
        params: dict[str, Any] = {c: coerced[c] for c in allowed}
        params["rid"] = self._coerce("uuid", "id", record_id)

        qt = self._qt(self._schema(ctx), table)
        res = await self.session.execute(
            text(f"UPDATE {qt} SET {set_sql} WHERE id = :rid RETURNING *"),
            params,
        )
        row = res.mappings().first()
        if row is None:
            raise PluginNotFoundError(
                f"Bản ghi '{record_id}' không tồn tại trong '{table}'."
            )
        return _jsonable(dict(row))

    async def delete_record(
        self,
        ctx: TenantContext,
        plugin_code: str,
        table: str,
        record_id: str,
    ) -> None:
        await self._resolve_table(plugin_code, table)
        await self._require_active(ctx, plugin_code)
        await self._require_prefix_perm(ctx, plugin_code)
        try:
            uuid.UUID(str(record_id))
        except ValueError as exc:
            raise DSLInvalidParametersError("record id phải là UUID.") from exc

        await self._columns(self._schema(ctx), table)  # probe bảng tồn tại
        try:
            rid = uuid.UUID(str(record_id))
        except ValueError as exc:
            raise DSLInvalidParametersError("record id phải là UUID.") from exc
        params: dict[str, Any] = {"rid": rid}

        qt = self._qt(self._schema(ctx), table)
        res = await self.session.execute(
            text(f"DELETE FROM {qt} WHERE id = :rid"),
            params,
        )
        if (res.rowcount or 0) == 0:
            raise PluginNotFoundError(
                f"Bản ghi '{record_id}' không tồn tại trong '{table}'."
            )

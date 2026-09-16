# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import re
import uuid

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractDSLDryRunRepository

logger = structlog.get_logger(__name__)

# Mỗi identifier (table hoặc từng phần plugin_code/resource) phải khớp.
_TABLE_PART_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
_SCHEMA_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")
_MAX_IDENT_LEN = 63


def _validate_schema_name(schema_name: str) -> str:
    if (
        not schema_name
        or len(schema_name) > _MAX_IDENT_LEN
        or not _SCHEMA_PATTERN.match(schema_name)
    ):
        raise ValueError(f"Invalid tenant schema name: {schema_name!r}")
    return schema_name


def _validate_table_name(target_table: str) -> str:
    """Validate target_table, hỗ trợ 'table' hoặc 'schema.table' / 'plugin/resource'.

    Mỗi phần phải khớp ^[a-z][a-z0-9_]*$. Trả về tên bảng cuối cùng.
    """
    if not target_table or not isinstance(target_table, str):
        raise ValueError("Invalid target_table: empty")
    cleaned = target_table.strip()
    if not cleaned or len(cleaned) > 128:
        raise ValueError(f"Invalid target_table: {target_table!r}")
    # Chặn traversal / injection hiển nhiên trước regex chi tiết.
    if ".." in cleaned or "/" in cleaned or "\\" in cleaned:
        raise ValueError(f"Invalid target_table (path traversal): {target_table!r}")
    if any(c in cleaned for c in (";", "--", "'", '"', "`", " ", "\t", "\n")):
        raise ValueError(f"Invalid target_table: {target_table!r}")
    # Cho phép 'schema.table' (lấy phần table) hoặc 'plugin.resource' dạng slash đã bị chặn ở trên.
    # Ở đây chỉ tách theo '.' — mỗi segment đều phải hợp lệ.
    if "." in cleaned:
        parts = cleaned.split(".")
        if len(parts) != 2 or not all(parts):
            raise ValueError(f"Invalid target_table: {target_table!r}")
        for part in parts:
            if len(part) > _MAX_IDENT_LEN or not _TABLE_PART_PATTERN.match(part):
                raise ValueError(f"Invalid target_table part: {part!r}")
        # Bỏ qua schema prefix do caller cung cấp — luôn dùng schema suy từ tenant.
        return parts[1]
    if len(cleaned) > _MAX_IDENT_LEN or not _TABLE_PART_PATTERN.match(cleaned):
        raise ValueError(f"Invalid target_table: {target_table!r}")
    return cleaned


def _try_manifest_allowlist(target_table: str) -> bool | None:
    """Kiểm tra target_table có trong manifest.database.tables không.

    Trả về True/False nếu load được manifests, None nếu không load được
    (caller bỏ qua allowlist nhưng vẫn giữ regex + information_schema check).
    """
    try:
        from app.adapters.external.local_manifest_parser import LocalManifestParser

        parser = LocalManifestParser()
        plugins_dir = parser.plugins_dir
        allowed: set[str] = set()
        found_any = False
        for manifest_path in sorted(plugins_dir.glob("*/manifest.yaml")):
            try:
                manifest = parser.parse(manifest_path.parent.name)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "dry_run allowlist: bỏ qua manifest lỗi",
                    path=str(manifest_path),
                    error=str(exc),
                )
                continue
            found_any = True
            if manifest.database:
                allowed.update(manifest.database.tables or [])
        if not found_any:
            return None
        return target_table in allowed
    except Exception as exc:  # noqa: BLE001
        logger.warning("dry_run allowlist: không load được manifests", error=str(exc))
        return None


class SQLAlchemyDSLDryRunRepository(AbstractDSLDryRunRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute_dry_run(self, tenant_id: str, target_table: str) -> dict:
        # 0. Validate tenant -> schema (schema-per-tenant, khớp plugin_install).
        try:
            uuid.UUID(str(tenant_id))
        except (ValueError, AttributeError, TypeError) as exc:
            raise ValueError(f"Invalid tenant_id: {tenant_id!r}") from exc
        schema_name = _validate_schema_name(f"tenant_{tenant_id}".replace("-", "_"))

        # 0b. Validate identifier từng phần plugin_code/resource.
        table_name = _validate_table_name(target_table)

        # 0c. Allowlist manifest tables nếu load được (defense-in-depth).
        allowlisted = _try_manifest_allowlist(table_name)
        if allowlisted is False:
            logger.warning(
                "dry_run bị chặn: bảng không thuộc manifest allowlist",
                table=table_name,
            )
            return {"affected_count": 0, "preview": []}

        # 1. Kiểm tra table TỒN TẠI trong schema của tenant (bind params, không f-string).
        check_table = await self._session.execute(
            text(
                "SELECT EXISTS ("
                "SELECT FROM information_schema.tables "
                "WHERE table_schema = :schema_name AND table_name = :table_name)"
            ),
            {"schema_name": schema_name, "table_name": table_name},
        )
        if not check_table.scalar():
            return {"affected_count": 0, "preview": []}

        # Identifier đã validate regex + tồn tại trong information_schema
        # nên quote `"schema"."table"` là an toàn (không còn user input thô).
        qt = f'"{schema_name}"."{table_name}"'

        # 1b. Probe cột để dựng WHERE động (tránh lỗi khi bảng không có
        # tenant_id/status — schema-per-tenant không có cột tenant_id).
        cols_res = await self._session.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = :schema_name AND table_name = :table_name"
            ),
            {"schema_name": schema_name, "table_name": table_name},
        )
        columns = {row[0] for row in cols_res.fetchall()}
        where_clauses: list[str] = []
        params: dict = {}
        if "tenant_id" in columns:
            where_clauses.append("tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id
        if "status" in columns:
            where_clauses.append("status = 'pending'")
        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        # 2. Count (chỉ SELECT, bind tenant_id).
        count_res = await self._session.execute(
            text(f"SELECT COUNT(*) FROM {qt} {where_sql}"),
            params,
        )
        affected_count = count_res.scalar() or 0

        if affected_count == 0:
            return {"affected_count": 0, "preview": []}

        # 3. Preview (tối đa 3 bản ghi).
        preview_res = await self._session.execute(
            text(f"SELECT * FROM {qt} {where_sql} LIMIT 3"),
            params,
        )

        cols = preview_res.keys()
        preview = [dict(zip(cols, row, strict=False)) for row in preview_res.fetchall()]

        for record in preview:
            for key, val in record.items():
                if hasattr(val, "isoformat"):
                    record[key] = val.isoformat()

        return {"affected_count": affected_count, "preview": preview}

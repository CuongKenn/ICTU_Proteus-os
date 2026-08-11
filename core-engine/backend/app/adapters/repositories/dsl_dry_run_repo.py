# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractDSLDryRunRepository


class SQLAlchemyDSLDryRunRepository(AbstractDSLDryRunRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def execute_dry_run(self, tenant_id: str, target_table: str) -> dict:
        # 1. Kiểm tra table
        check_table = await self._session.execute(
            text(
                "SELECT EXISTS ("
                "SELECT FROM information_schema.tables "
                "WHERE table_name = :table_name)"
            ),
            {"table_name": target_table},
        )
        if not check_table.scalar():
            return {"affected_count": 0, "preview": []}

        # 2. Count
        sql_count = text(
            f"SELECT COUNT(*) FROM {target_table} "
            f"WHERE tenant_id = :tenant_id AND status = 'pending'"
        )
        count_res = await self._session.execute(sql_count, {"tenant_id": tenant_id})
        affected_count = count_res.scalar() or 0

        if affected_count == 0:
            return {"affected_count": 0, "preview": []}

        # 3. Preview
        sql_preview = text(
            f"SELECT * FROM {target_table} "
            f"WHERE tenant_id = :tenant_id AND status = 'pending' LIMIT 3"
        )
        preview_res = await self._session.execute(sql_preview, {"tenant_id": tenant_id})

        cols = preview_res.keys()
        preview = [dict(zip(cols, row, strict=False)) for row in preview_res.fetchall()]

        for record in preview:
            for key, val in record.items():
                if hasattr(val, "isoformat"):
                    record[key] = val.isoformat()

        return {"affected_count": affected_count, "preview": preview}

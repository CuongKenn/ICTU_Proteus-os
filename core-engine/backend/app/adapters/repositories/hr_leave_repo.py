# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractHRLeaveRepository


class SQLAlchemyHRLeaveRepository(AbstractHRLeaveRepository):
    """Adapter: Implement HR Leave Repository dùng SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_pending_leaves_older_than(self, days: int) -> list[dict] | None:
        # Kiểm tra xem bảng hr_leave_requests có tồn tại không trước khi query
        check_table = await self._session.execute(
            text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hr_leave_requests')"
            )
        )
        has_hr = check_table.scalar()

        if not has_hr:
            return None

        now = datetime.now(UTC)
        day_ago = now - timedelta(days=days)

        sql_leaves = text("""
            SELECT employee_id, created_at, days_count 
            FROM hr_leave_requests
            WHERE status = 'pending'
              AND created_at < :day_ago
        """)
        res_leaves = await self._session.execute(sql_leaves, {"day_ago": day_ago})
        rows = res_leaves.mappings().all()
        return [dict(row) for row in rows]

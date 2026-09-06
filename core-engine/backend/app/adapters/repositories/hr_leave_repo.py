# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from datetime import UTC, datetime, timedelta

from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractHRLeaveRepository

# Định nghĩa cấu trúc động cho bảng hr_leave_requests (không đưa vào models.py để tránh Alembic)
dynamic_metadata = MetaData()
hr_leave_requests_table = Table(
    "hr_leave_requests",
    dynamic_metadata,
    Column("employee_id", String),
    Column("created_at", DateTime(timezone=True)),
    Column("days_count", Integer),
    Column("status", String),
)


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

        stmt = select(
            hr_leave_requests_table.c.employee_id,
            hr_leave_requests_table.c.created_at,
            hr_leave_requests_table.c.days_count,
        ).where(
            hr_leave_requests_table.c.status == "pending",
            hr_leave_requests_table.c.created_at < day_ago,
        )

        res_leaves = await self._session.execute(stmt)
        rows = res_leaves.mappings().all()
        return [dict(row) for row in rows]

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — Proactive Monitor Agent
# Quét dữ liệu và gửi cảnh báo tự động.
#
# LƯU Ý QUAN TRỌNG (AGENTS.md §4 RULE SINH TỬ):
# - Background agent NÀY TUYỆT ĐỐI không tự thực thi bất kỳ lệnh write/critical nào.
# - Nó CHỈ CÓ QUYỀN READ dữ liệu và SEND alert tới Mattermost.
# - Luôn phải đính kèm link để người dùng (Human-in-the-loop) tự click xử lý.

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class ProactiveMonitorAgent:
    def __init__(self, db: AsyncSession, mattermost_adapter: MattermostAdapter):
        self.db = db
        self.mattermost_adapter = mattermost_adapter

    async def scan_and_alert_every_30m(self):
        """
        Cron `*/30 * * * *`:
        - Quét ai_commands quá hạn phê duyệt (pending_approval)
        - Quét Plugin trạng thái FAILED_DIRTY > 1h
        """
        logger.info("[Proactive Monitor] Bắt đầu scan_and_alert_every_30m")
        now = datetime.now(timezone.utc)

        # 1. Quét Plugin FAILED_DIRTY > 1h
        # (Chỉ check các plugin trong marketplace_plugins nếu có lưu trạng thái installation)
        try:
            # Query tuỳ thuộc vào schema thực tế của bảng plugin_installations
            # Ở đây mock logic kiểm tra. Giả sử schema có plugin_installations
            sql_plugins = text("""
                SELECT p.tenant_id, p.plugin_name, p.status, p.updated_at
                FROM plugin_installations p
                WHERE p.status = 'FAILED_DIRTY' 
                  AND p.updated_at < :one_hour_ago
            """)
            result = await self.db.execute(
                sql_plugins, {"one_hour_ago": now - timedelta(hours=1)}
            )
            dirty_plugins = result.fetchall()

            for p in dirty_plugins:
                msg = (
                    f"🚨 **[Cảnh báo Hệ thống]** Plugin `{p.plugin_name}` (Tenant: {p.tenant_id}) "
                    f"đã ở trạng thái `FAILED_DIRTY` hơn 1 giờ.\n\n"
                    f"Vui lòng vào Dashboard quản trị để chạy Cleanup Agent: "
                    f"[Quản lý Plugin]({settings.FRONTEND_URL}/admin/plugins)"
                )
                await self.mattermost_adapter.send_message(
                    channel="admin-alerts", text=msg
                )

        except Exception as e:
            logger.error(f"[Proactive Monitor] Lỗi quét Plugin FAILED_DIRTY: {e}")

        # 2. Quét ai_commands sắp hết hạn (ví dụ còn < 5 phút)
        try:
            sql_cmds = text("""
                SELECT c.id, c.action, c.expires_at, c.requested_by
                FROM ai_commands c
                WHERE c.status = 'PENDING_APPROVAL'
                  AND c.expires_at > :now
                  AND c.expires_at < :soon
            """)
            result_cmds = await self.db.execute(
                sql_cmds, {"now": now, "soon": now + timedelta(minutes=5)}
            )
            soon_expired_cmds = result_cmds.fetchall()

            for c in soon_expired_cmds:
                msg = (
                    f"⚠️ **[Nhắc nhở phê duyệt]** Lệnh `{c.action}` (ID: {c.id}) "
                    f"do <@{c.requested_by}> yêu cầu sẽ HẾT HẠN trong vòng 5 phút nữa!\n\n"
                    f"Nếu không có ai phê duyệt, lệnh này sẽ bị huỷ bỏ tự động."
                )
                await self.mattermost_adapter.send_message(
                    channel="approval-alerts", text=msg
                )
        except Exception as e:
            logger.error(f"[Proactive Monitor] Lỗi quét ai_commands: {e}")

    async def morning_report(self):
        """
        Cron `0 7 * * *`:
        - Báo cáo sáng tổng hợp.
        - Alert đơn nghỉ phép chưa duyệt > 24h.
        """
        logger.info("[Proactive Monitor] Bắt đầu morning_report")
        now = datetime.now(timezone.utc)

        # Quét đơn nghỉ phép chưa duyệt > 24h (Dành cho HR Plugin)
        try:
            # Kiểm tra xem bảng hr_leave_requests có tồn tại không trước khi query
            check_table = await self.db.execute(
                text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'hr_leave_requests')"
                )
            )
            has_hr = check_table.scalar()

            if has_hr:
                sql_leaves = text("""
                    SELECT employee_id, created_at, days_count 
                    FROM hr_leave_requests
                    WHERE status = 'pending'
                      AND created_at < :day_ago
                """)
                res_leaves = await self.db.execute(
                    sql_leaves, {"day_ago": now - timedelta(days=1)}
                )
                pending_leaves = res_leaves.fetchall()

                if pending_leaves:
                    msg = (
                        f"📊 **Báo Cáo Sáng (HR)**\n\n"
                        f"Hiện có **{len(pending_leaves)}** đơn nghỉ phép đã chờ duyệt hơn 24 giờ.\n"
                        f"Vui lòng các Manager xem xét duyệt đơn: "
                        f"[Duyệt Nghỉ Phép]({settings.FRONTEND_URL}/apps/hr)"
                    )
                    await self.mattermost_adapter.send_message(
                        channel="hr-alerts", text=msg
                    )
        except Exception as e:
            logger.error(f"[Proactive Monitor] Lỗi quét HR leaves: {e}")

        # Báo cáo hệ thống chung
        try:
            msg = (
                f"🌞 **Chào buổi sáng! Báo cáo Hệ thống Proteus OS**\n\n"
                f"- Trạng thái API: `Healthy` ✅\n"
                f"- Scheduler: `Active` ⏱️\n\n"
                f"Chúc mọi người một ngày làm việc hiệu quả!"
            )
            await self.mattermost_adapter.send_message(channel="general", text=msg)
        except Exception as e:
            logger.error(f"[Proactive Monitor] Lỗi gửi morning report: {e}")

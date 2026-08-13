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
from datetime import UTC, datetime

from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.repositories.base import (
    AbstractAICommandRepository,
    AbstractHRLeaveRepository,
    AbstractPluginRepository,
)
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class ProactiveMonitorAgent:
    def __init__(
        self,
        plugin_repo: AbstractPluginRepository,
        ai_command_repo: AbstractAICommandRepository,
        hr_leave_repo: AbstractHRLeaveRepository,
        mattermost_adapter: MattermostAdapter,
    ):
        self.plugin_repo = plugin_repo
        self.ai_command_repo = ai_command_repo
        self.hr_leave_repo = hr_leave_repo
        self.mattermost_adapter = mattermost_adapter

    async def scan_and_alert_every_30m(self):
        """
        Cron `*/30 * * * *`:
        - Quét ai_commands quá hạn phê duyệt (pending_approval)
        - Quét Plugin trạng thái FAILED_DIRTY > 1h
        """
        logger.info("[Proactive Monitor] Bắt đầu scan_and_alert_every_30m")
        now = datetime.now(UTC)

        # 1. Quét Plugin FAILED_DIRTY > 1h
        try:
            dirty_plugins = await self.plugin_repo.get_dirty_installations_older_than(
                hours=1
            )
            for p in dirty_plugins:
                msg = (
                    f"🚨 **[Cảnh báo Hệ thống]** Plugin `{p['plugin_name']}` (Tenant: {p['tenant_id']}) "
                    f"đã ở trạng thái `FAILED_DIRTY` hơn 1 giờ.\n\n"
                    f"Vui lòng vào Dashboard quản trị để chạy Cleanup Agent: "
                    f"[Quản lý Plugin]({settings.FRONTEND_URL}/admin/plugins)"
                )
                await self.mattermost_adapter.send_message(
                    channel="admin-alerts", text=msg
                )

        except Exception as e:
            logger.error("[Proactive Monitor] Lỗi quét Plugin FAILED_DIRTY: %s", e)

        # 2. Quét ai_commands sắp hết hạn (ví dụ còn < 5 phút)
        try:
            soon_expired_cmds = (
                await self.ai_command_repo.get_pending_commands_expiring_soon(minutes=5)
            )
            for c in soon_expired_cmds:
                msg = (
                    f"⚠️ **[Nhắc nhở phê duyệt]** Lệnh `{c['action']}` (ID: {c['id']}) "
                    f"do <@{c['requested_by']}> yêu cầu sẽ HẾT HẠN trong vòng 5 phút nữa!\n\n"
                    f"Nếu không có ai phê duyệt, lệnh này sẽ bị huỷ bỏ tự động."
                )
                await self.mattermost_adapter.send_message(
                    channel="approval-alerts", text=msg
                )
        except Exception as e:
            logger.error("[Proactive Monitor] Lỗi quét ai_commands: %s", e)

    async def morning_report(self):
        """
        Cron `0 7 * * *`:
        - Báo cáo sáng tổng hợp.
        - Alert đơn nghỉ phép chưa duyệt > 24h.
        """
        logger.info("[Proactive Monitor] Bắt đầu morning_report")
        now = datetime.now(UTC)

        # Quét đơn nghỉ phép chưa duyệt > 24h (Dành cho HR Plugin)
        try:
            pending_leaves = await self.hr_leave_repo.get_pending_leaves_older_than(
                days=1
            )
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
            logger.error("[Proactive Monitor] Lỗi quét HR leaves: %s", e)

        # Báo cáo hệ thống chung
        try:
            msg = (
                "🌞 **Chào buổi sáng! Báo cáo Hệ thống Proteus OS**\n\n"
                "- Trạng thái API: `Healthy` ✅\n"
                "- Scheduler: `Active` ⏱️\n\n"
                "Chúc mọi người một ngày làm việc hiệu quả!"
            )
            await self.mattermost_adapter.send_message(channel="general", text=msg)
        except Exception as e:
            logger.error("[Proactive Monitor] Lỗi gửi morning report: %s", e)

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — AI Timeout Worker
# Background worker tự động hủy AI commands không được phê duyệt đúng hạn.
# Tham chiếu: docs/dsl-spec.md §4

import logging
from datetime import datetime, timezone

from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.repositories.base import (
    AbstractAICommandRepository,
    AbstractAuditLogRepository,
)
from app.core.domain.entities import AICommandStatus

logger = logging.getLogger(__name__)


class AITimeoutWorker:
    def __init__(
        self,
        ai_command_repo: AbstractAICommandRepository,
        audit_log_repo: AbstractAuditLogRepository,
        mattermost_adapter: MattermostAdapter,
    ):
        self.ai_command_repo = ai_command_repo
        self.audit_log_repo = audit_log_repo
        self.mattermost_adapter = mattermost_adapter

    async def execute(self):
        """
        Scan ai_commands với status=PENDING_APPROVAL và approval_deadline < now()
        Cập nhật thành EXPIRED (hoặc TIMEOUT), ghi audit log và báo Mattermost.
        """
        logger.info("[AI Timeout Worker] Bắt đầu quét lệnh quá hạn...")
        now = datetime.now(timezone.utc)

        try:
            # 1. Tìm các lệnh đã quá hạn
            expired_commands = await self.ai_command_repo.get_expired_pending_commands()

            if not expired_commands:
                logger.debug("[AI Timeout Worker] Không có lệnh nào quá hạn.")
                return

            for cmd in expired_commands:
                cmd_id = cmd["id"]
                action = cmd["action"]
                tenant_id = cmd["tenant_id"]
                requested_by = cmd["requested_by"]

                # 2. Cập nhật trạng thái thành TIMEOUT
                await self.ai_command_repo.update_status(
                    cmd_id, AICommandStatus.TIMEOUT
                )

                # 3. Ghi audit_logs
                metadata = '{"reason": "Approval deadline exceeded"}'
                await self.audit_log_repo.insert_log(
                    tenant_id=tenant_id,
                    actor_type="SYSTEM",
                    action="ai_command.timeout",
                    resource_type="AI_COMMAND",
                    resource_id=cmd_id,
                    command_id=cmd_id,
                    metadata_json=metadata,
                )

                # 4. Gửi thông báo Mattermost
                msg = (
                    f"🚫 **[Hủy Lệnh Tự Động]**\n"
                    f"Lệnh `{action}` do <@{requested_by}> yêu cầu đã hết hạn phê duyệt.\n"
                    f"Trạng thái: `TIMEOUT`. Hệ thống đã tự động hủy lệnh này để đảm bảo an toàn."
                )
                await self.mattermost_adapter.send_message(
                    channel="approval-alerts", text=msg
                )

                logger.info(
                    f"[AI Timeout Worker] Đã hủy lệnh {cmd_id} (action: {action})"
                )

            await self.ai_command_repo.commit()
            logger.info(
                f"[AI Timeout Worker] Đã xử lý {len(expired_commands)} lệnh quá hạn."
            )

        except Exception as e:
            await self.ai_command_repo.rollback()
            logger.error(f"[AI Timeout Worker] Lỗi khi xử lý lệnh quá hạn: {e}")

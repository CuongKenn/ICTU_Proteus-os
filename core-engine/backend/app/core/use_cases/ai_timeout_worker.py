# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — AI Timeout Worker
# Background worker tự động hủy AI commands không được phê duyệt đúng hạn.
# Tham chiếu: docs/dsl-spec.md §4

import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.adapters.external.mattermost_adapter import MattermostAdapter

logger = logging.getLogger(__name__)

class AITimeoutWorker:
    def __init__(self, db: AsyncSession, mattermost_adapter: MattermostAdapter):
        self.db = db
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
            sql_find = text("""
                SELECT id, action, tenant_id, requested_by
                FROM ai_commands
                WHERE status = 'PENDING_APPROVAL'
                  AND approval_deadline < :now
            """)
            result = await self.db.execute(sql_find, {"now": now})
            expired_commands = result.fetchall()

            if not expired_commands:
                logger.debug("[AI Timeout Worker] Không có lệnh nào quá hạn.")
                return

            for cmd in expired_commands:
                cmd_id = cmd.id
                action = cmd.action
                tenant_id = cmd.tenant_id
                requested_by = cmd.requested_by

                # 2. Cập nhật trạng thái thành TIMEOUT
                sql_update = text("""
                    UPDATE ai_commands
                    SET status = 'TIMEOUT', updated_at = :now
                    WHERE id = :cmd_id
                """)
                await self.db.execute(sql_update, {"now": now, "cmd_id": cmd_id})

                # 3. Ghi audit_logs
                sql_audit = text("""
                    INSERT INTO audit_logs (
                        tenant_id, actor_type, action, resource_type, resource_id, command_id, metadata, created_at
                    ) VALUES (
                        :tenant_id, 'SYSTEM', 'ai_command.timeout', 'AI_COMMAND', :cmd_id, :cmd_id, :metadata, :now
                    )
                """)
                metadata = '{"reason": "Approval deadline exceeded"}'
                await self.db.execute(sql_audit, {
                    "tenant_id": tenant_id,
                    "cmd_id": cmd_id,
                    "metadata": metadata,
                    "now": now
                })

                # 4. Gửi thông báo Mattermost
                msg = (
                    f"🚫 **[Hủy Lệnh Tự Động]**\n"
                    f"Lệnh `{action}` do <@{requested_by}> yêu cầu đã hết hạn phê duyệt.\n"
                    f"Trạng thái: `TIMEOUT`. Hệ thống đã tự động hủy lệnh này để đảm bảo an toàn."
                )
                await self.mattermost_adapter.send_message(channel="approval-alerts", text=msg)

                logger.info(f"[AI Timeout Worker] Đã hủy lệnh {cmd_id} (action: {action})")

            await self.db.commit()
            logger.info(f"[AI Timeout Worker] Đã xử lý {len(expired_commands)} lệnh quá hạn.")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"[AI Timeout Worker] Lỗi khi xử lý lệnh quá hạn: {e}")

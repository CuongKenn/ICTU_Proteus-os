# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — AI Command Executor
# Xử lý DX-DSL actions với các effect: read, write, critical.
# Tham chiếu: docs/dsl-spec.md §4, AGENTS.md §4 (Human-in-the-loop)

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.external.n8n_adapter import N8nAdapter

logger = logging.getLogger(__name__)

class AICommandUseCase:
    def __init__(self, db: AsyncSession, mattermost_adapter: MattermostAdapter, n8n_adapter: N8nAdapter):
        self.db = db
        self.mattermost_adapter = mattermost_adapter
        self.n8n_adapter = n8n_adapter

    async def execute_command(self, tenant_id: str, user_id: str, session_id: str, dsl_payload: dict) -> dict:
        """
        Xử lý AI command dựa trên mức độ effect:
        - read: chạy luôn qua n8n webhook (nếu cần) hoặc query và trả về kết quả
        - write: validate -> PENDING_APPROVAL (30m) -> gửi Mattermost
        - critical: validate -> PENDING_APPROVAL (15m) -> gửi Mattermost (yêu cầu 2 approvers)
        """
        action = dsl_payload.get("action", "")
        effect = dsl_payload.get("effect", "read")
        now = datetime.now(timezone.utc)

        logger.info(f"[AI Command] Bắt đầu xử lý lệnh: {action} (effect={effect}) bởi user={user_id}")

        if effect == "read":
            # 1. READ: Thực thi luôn
            # Ví dụ query trực tiếp hoặc gọi n8n
            # ... mock execution
            result_data = {"status": "success", "data": "Dữ liệu trả về từ hệ thống"}
            
            sql_insert = text("""
                INSERT INTO ai_commands (
                    tenant_id, issued_by_user_id, session_id, dsl_payload, action, effect, status, execution_result, executed_at, created_at
                ) VALUES (
                    :tenant_id, :user_id, :session_id, :payload, :action, :effect, 'COMPLETED', :result, :now, :now
                ) RETURNING id
            """)
            res = await self.db.execute(sql_insert, {
                "tenant_id": tenant_id, "user_id": user_id, "session_id": session_id,
                "payload": str(dsl_payload).replace("'", '"'), "action": action, "effect": effect,
                "result": str(result_data).replace("'", '"'), "now": now
            })
            cmd_id = res.scalar()
            await self.db.commit()

            return {
                "status": "completed",
                "message": "Đã xử lý thành công",
                "result": result_data,
                "command_id": str(cmd_id)
            }

        else:
            # 2. WRITE / CRITICAL: Yêu cầu phê duyệt
            timeout_minutes = 15 if effect == "critical" else 30
            deadline = now + timedelta(minutes=timeout_minutes)
            
            # Dry run (mock)
            dry_run_result = {"affected_count": 5, "preview": ["item 1", "item 2"]}

            sql_insert = text("""
                INSERT INTO ai_commands (
                    tenant_id, issued_by_user_id, session_id, dsl_payload, action, effect, status, dry_run_result, approval_deadline, created_at
                ) VALUES (
                    :tenant_id, :user_id, :session_id, :payload, :action, :effect, 'PENDING_APPROVAL', :dry_run, :deadline, :now
                ) RETURNING id
            """)
            res = await self.db.execute(sql_insert, {
                "tenant_id": tenant_id, "user_id": user_id, "session_id": session_id,
                "payload": str(dsl_payload).replace("'", '"'), "action": action, "effect": effect,
                "dry_run": str(dry_run_result).replace("'", '"'), "deadline": deadline, "now": now
            })
            cmd_id = res.scalar()

            # Gửi tin nhắn Mattermost Interactive (mock interactive)
            approver_req = "2 Người Quản Lý" if effect == "critical" else "1 Người Quản Lý"
            msg = (
                f"🔒 **[Yêu Cầu Phê Duyệt]** ({effect.upper()})\n"
                f"Người yêu cầu: <@{user_id}>\n"
                f"Hành động: `{action}`\n"
                f"Yêu cầu phê duyệt từ: {approver_req}\n"
                f"Hạn duyệt: `{deadline.strftime('%H:%M:%S %d/%m/%Y')} UTC`\n"
            )
            # Dùng interactive button trong thực tế
            await self.mattermost_adapter.send_message(channel="approval-requests", text=msg)

            await self.db.commit()

            return {
                "status": "pending_approval",
                "message": "Lệnh cần phê duyệt",
                "dsl_preview": {
                    "command_id": str(cmd_id),
                    "action": action,
                    "effect": effect,
                    "approval_deadline": deadline.isoformat(),
                    "dry_run_result": dry_run_result
                }
            }

    async def process_approval(self, cmd_id: str, approver_id: str, action_taken: str) -> bool:
        """
        Xử lý khi người dùng bấm [Phê duyệt] hoặc [Hủy bỏ] trên Mattermost.
        Hàm này sẽ được gọi từ Mattermost Webhook Router (Task 36).
        """
        now = datetime.now(timezone.utc)
        
        sql_find = text("""
            SELECT id, effect, status, approved_by, second_approver
            FROM ai_commands
            WHERE id = :cmd_id
        """)
        res = await self.db.execute(sql_find, {"cmd_id": cmd_id})
        cmd = res.fetchone()

        if not cmd or cmd.status != 'PENDING_APPROVAL':
            return False

        if action_taken == "reject":
            sql_reject = text("UPDATE ai_commands SET status = 'REJECTED', updated_at = :now WHERE id = :cmd_id")
            await self.db.execute(sql_reject, {"now": now, "cmd_id": cmd_id})
            await self.db.commit()
            return True

        # process approve
        if cmd.effect == "critical":
            if not cmd.approved_by:
                sql_update = text("UPDATE ai_commands SET approved_by = :approver, updated_at = :now WHERE id = :cmd_id")
                await self.db.execute(sql_update, {"approver": approver_id, "now": now, "cmd_id": cmd_id})
                await self.db.commit()
                return True
            elif cmd.approved_by != approver_id:
                # Có đủ 2 approvers
                sql_update = text("UPDATE ai_commands SET second_approver = :approver, status = 'APPROVED', updated_at = :now WHERE id = :cmd_id")
                await self.db.execute(sql_update, {"approver": approver_id, "now": now, "cmd_id": cmd_id})
                await self.db.commit()
                # trigger execute queue here...
                return True
            else:
                # 1 người ko thể duyệt 2 lần
                return False
        else:
            # write effect
            sql_update = text("UPDATE ai_commands SET approved_by = :approver, status = 'APPROVED', updated_at = :now WHERE id = :cmd_id")
            await self.db.execute(sql_update, {"approver": approver_id, "now": now, "cmd_id": cmd_id})
            await self.db.commit()
            # trigger execute queue here...
            return True

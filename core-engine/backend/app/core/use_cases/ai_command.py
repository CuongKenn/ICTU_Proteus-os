# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — AI Command Executor
# Xử lý DX-DSL actions với các effect: read, write, critical.
# Tham chiếu: docs/dsl-spec.md §4, AGENTS.md §4 (Human-in-the-loop)

import logging
from datetime import datetime, timedelta, timezone

from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.external.n8n_adapter import N8nAdapter
from app.adapters.repositories.base import AbstractAICommandRepository

logger = logging.getLogger(__name__)


class AICommandUseCase:
    def __init__(
        self,
        ai_command_repo: AbstractAICommandRepository,
        mattermost_adapter: MattermostAdapter,
        n8n_adapter: N8nAdapter,
    ):
        self.ai_command_repo = ai_command_repo
        self.mattermost_adapter = mattermost_adapter
        self.n8n_adapter = n8n_adapter

    async def execute_command(
        self, tenant_id: str, user_id: str, session_id: str, dsl_payload: dict
    ) -> dict:
        """
        Xử lý AI command dựa trên mức độ effect:
        - read: chạy luôn qua n8n webhook (nếu cần) hoặc query và trả về kết quả
        - write: validate -> PENDING_APPROVAL (30m) -> gửi Mattermost
        - critical: validate -> PENDING_APPROVAL (15m) -> gửi Mattermost (yêu cầu 2 approvers)
        """
        action = dsl_payload.get("action", "")
        effect = dsl_payload.get("effect", "read")
        now = datetime.now(timezone.utc)

        logger.info(
            f"[AI Command] Bắt đầu xử lý lệnh: {action} (effect={effect}) bởi user={user_id}"
        )

        if effect == "read":
            # 1. READ: Thực thi luôn
            # Ví dụ query trực tiếp hoặc gọi n8n
            # ... mock execution
            result_data = {"status": "success", "data": "Dữ liệu trả về từ hệ thống"}

            cmd_id = await self.ai_command_repo.create_command(
                {
                    "tenant_id": tenant_id,
                    "issued_by_user_id": user_id,
                    "session_id": session_id,
                    "dsl_payload": str(dsl_payload).replace("'", '"'),
                    "action": action,
                    "effect": effect,
                    "status": "COMPLETED",
                    "execution_result": str(result_data).replace("'", '"'),
                    "executed_at": now,
                    "created_at": now,
                }
            )
            await self.ai_command_repo.commit()

            return {
                "status": "completed",
                "message": "Đã xử lý thành công",
                "result": result_data,
                "command_id": str(cmd_id),
            }

        else:
            # 2. WRITE / CRITICAL: Yêu cầu phê duyệt
            timeout_minutes = 15 if effect == "critical" else 30
            deadline = now + timedelta(minutes=timeout_minutes)

            # Dry run (mock)
            dry_run_result = {"affected_count": 5, "preview": ["item 1", "item 2"]}

            cmd_id = await self.ai_command_repo.create_command(
                {
                    "tenant_id": tenant_id,
                    "issued_by_user_id": user_id,
                    "session_id": session_id,
                    "dsl_payload": str(dsl_payload).replace("'", '"'),
                    "action": action,
                    "effect": effect,
                    "status": "PENDING_APPROVAL",
                    "dry_run_result": str(dry_run_result).replace("'", '"'),
                    "approval_deadline": deadline,
                    "created_at": now,
                }
            )

            # Gửi tin nhắn Mattermost Interactive (mock interactive)
            approver_req = (
                "2 Người Quản Lý" if effect == "critical" else "1 Người Quản Lý"
            )
            msg = (
                f"🔒 **[Yêu Cầu Phê Duyệt]** ({effect.upper()})\n"
                f"Người yêu cầu: <@{user_id}>\n"
                f"Hành động: `{action}`\n"
                f"Yêu cầu phê duyệt từ: {approver_req}\n"
                f"Hạn duyệt: `{deadline.strftime('%H:%M:%S %d/%m/%Y')} UTC`\n"
            )
            # Dùng interactive button trong thực tế
            await self.mattermost_adapter.send_message(
                channel="approval-requests", text=msg
            )

            await self.ai_command_repo.commit()

            return {
                "status": "pending_approval",
                "message": "Lệnh cần phê duyệt",
                "dsl_preview": {
                    "command_id": str(cmd_id),
                    "action": action,
                    "effect": effect,
                    "approval_deadline": deadline.isoformat(),
                    "dry_run_result": dry_run_result,
                },
            }

    async def process_approval(
        self, cmd_id: str, approver_id: str, action_taken: str
    ) -> bool:
        """
        Xử lý khi người dùng bấm [Phê duyệt] hoặc [Hủy bỏ] trên Mattermost.
        Hàm này sẽ được gọi từ Mattermost Webhook Router (Task 36).
        """
        now = datetime.now(timezone.utc)

        cmd = await self.ai_command_repo.get_command_by_id(cmd_id)

        if not cmd or cmd["status"] != "PENDING_APPROVAL":
            return False

        if action_taken == "reject":
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, status="REJECTED"
            )
            await self.ai_command_repo.commit()
            return True

        # process approve
        if cmd["effect"] == "critical":
            if not cmd["approved_by"]:
                await self.ai_command_repo.update_command_approval(
                    cmd_id=cmd_id, approved_by=approver_id
                )
                await self.ai_command_repo.commit()
                return True
            elif cmd["approved_by"] != approver_id:
                # Có đủ 2 approvers
                await self.ai_command_repo.update_command_approval(
                    cmd_id=cmd_id, second_approver=approver_id, status="APPROVED"
                )
                await self.ai_command_repo.commit()
                # trigger execute queue here...
                return True
            else:
                # 1 người ko thể duyệt 2 lần
                return False
        else:
            # write effect
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, approved_by=approver_id, status="APPROVED"
            )
            await self.ai_command_repo.commit()
            # trigger execute queue here...
            return True

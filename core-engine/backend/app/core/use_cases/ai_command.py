# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — AI Command Executor
# Xử lý DX-DSL actions với các effect: read, write, critical.
# Tham chiếu: docs/dsl-spec.md §4, AGENTS.md §4 (Human-in-the-loop)

import json
import logging
from datetime import UTC, datetime, timedelta

from app.adapters.repositories.base import (
    AbstractAICommandRepository,
    AbstractDSLDryRunRepository,
    AbstractPluginRepository,
)
from app.adapters.repositories.role_repo import RoleRepository
from app.core.domain.entities import AICommandStatus, TenantContext
from app.core.domain.ports import AbstractChatOpsPort, AbstractWorkflowEnginePort
from app.core.use_cases.dsl_validator import DSLValidator
from app.entrypoints.schemas.ai_command import AICommandRequest
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class AICommandUseCase:
    """
    Xử lý vòng đời của một AI Command (DX-DSL).
    Tuân thủ quy tắc phê duyệt theo effect (AGENTS.md §4).
    """

    def __init__(
        self,
        plugin_repo: AbstractPluginRepository,
        ai_command_repo: AbstractAICommandRepository,
        dsl_dry_run_repo: AbstractDSLDryRunRepository,
        role_repo: RoleRepository,
        mattermost_adapter: AbstractChatOpsPort,
        n8n_adapter: AbstractWorkflowEnginePort,
    ):
        self.plugin_repo = plugin_repo
        self.ai_command_repo = ai_command_repo
        self.dsl_dry_run_repo = dsl_dry_run_repo
        self.role_repo = role_repo
        self.mattermost_adapter = mattermost_adapter
        self.n8n_adapter = n8n_adapter

    async def execute(
        self, body: AICommandRequest, ctx: TenantContext
    ) -> tuple[AICommandStatus, str, dict | None]:
        """
        Thực thi lệnh. Trả về (status, message, result).
        """
        payload = {
            "version": body.dsl_version,
            "action": body.action,
            "effect": body.effect,
            "parameters": body.parameters,
        }

        # 1. Validate DSL theo dsl-spec.md
        dsl_validator = DSLValidator(
            plugin_repo=self.plugin_repo,
            role_repo=self.role_repo,
            tenant_id=str(ctx.tenant_id),
            user_id=str(ctx.user_id),
        )
        await dsl_validator.validate(dsl_payload=body.model_dump())

        now = datetime.now(UTC)

        # 2. Xử lý theo effect
        if body.effect == "read":
            # Lệnh Read → Gửi n8n execute lập tức (vì là webhook trigger proxy)
            try:
                webhook_url = self.n8n_adapter.build_webhook_url(body.action)
                response = await self.n8n_adapter.trigger_webhook(
                    webhook_url=webhook_url,
                    payload=body.model_dump(),
                )

                # Lưu DB ngay
                await self.ai_command_repo.create_command(
                    {
                        "id": body.command_id,
                        "tenant_id": ctx.tenant_id,
                        "issued_by_user_id": ctx.user_id,
                        "session_id": body.session_id,
                        "dsl_version": body.dsl_version,
                        "action": body.action,
                        "effect": body.effect,
                        "parameters": (
                            json.dumps(body.parameters) if body.parameters else "{}"
                        ),
                        "status": AICommandStatus.COMPLETED.value,
                        "execution_result": (
                            json.dumps(response) if response is not None else None
                        ),
                        "executed_at": now,
                        "created_at": now,
                    }
                )
                await self.ai_command_repo.commit()
                return (
                    AICommandStatus.COMPLETED,
                    "Lệnh đọc dữ liệu đã thực thi thành công.",
                    response,
                )
            except Exception as e:
                logger.error("Read command execution failed: %s", e)
                # Ghi log thất bại
                await self.ai_command_repo.create_command(
                    {
                        "id": body.command_id,
                        "tenant_id": ctx.tenant_id,
                        "issued_by_user_id": ctx.user_id,
                        "session_id": body.session_id,
                        "dsl_version": body.dsl_version,
                        "action": body.action,
                        "effect": body.effect,
                        "parameters": (
                            json.dumps(body.parameters) if body.parameters else "{}"
                        ),
                        "status": AICommandStatus.FAILED.value,
                        "execution_result": json.dumps({"error": str(e)}),
                        "executed_at": now,
                        "created_at": now,
                    }
                )
                await self.ai_command_repo.commit()
                return AICommandStatus.FAILED, f"Lỗi khi thực thi: {e}", None

        # Write or Critical → Cần phê duyệt (Human-in-the-loop)
        deadline_minutes = 30 if body.effect == "write" else 15
        approval_deadline = now + timedelta(minutes=deadline_minutes)

        # Dry run preview
        try:
            target_table = (
                body.action.split(".")[1] if "." in body.action else "unknown"
            )
            dry_run_res = await self.dsl_dry_run_repo.execute_dry_run(
                tenant_id=str(ctx.tenant_id), target_table=target_table
            )
        except Exception:
            dry_run_res = {"preview": "Không thể thực hiện dry run"}

        # Lưu DB
        await self.ai_command_repo.create_command(
            {
                "id": body.command_id,
                "tenant_id": ctx.tenant_id,
                "issued_by_user_id": ctx.user_id,
                "session_id": body.session_id,
                "dsl_version": body.dsl_version,
                "action": body.action,
                "effect": body.effect,
                "parameters": json.dumps(body.parameters) if body.parameters else "{}",
                "status": AICommandStatus.PENDING_APPROVAL.value,
                "approval_deadline": approval_deadline,
                "dry_run_result": (
                    json.dumps(dry_run_res) if dry_run_res is not None else None
                ),
                "created_at": now,
            }
        )
        await self.ai_command_repo.commit()

        # Gửi thông báo phê duyệt qua Mattermost
        msg_text = (
            f"**[AI Command Approval Required]**\n"
            f"- **Action:** `{body.action}`\n"
            f"- **Effect:** {body.effect.upper()}\n"
            f"- **User:** {ctx.user_id}\n"
            f"- **Deadline:** {deadline_minutes} phút\n"
            f"Vui lòng phê duyệt hoặc từ chối tại Dashboard."
        )
        try:
            await self.mattermost_adapter.send_message(
                channel_id=settings.MATTERMOST_SYSTEM_CHANNEL_ID, text=msg_text
            )
        except Exception as e:
            logger.warning("Could not send Mattermost approval request: %s", e)

        msg = (
            f"Command đã được nhận và đang chờ phê duyệt. Hết hạn sau "
            f"{deadline_minutes} phút."
        )
        return AICommandStatus.PENDING_APPROVAL, msg, dry_run_res

    async def process_approval(
        self, cmd_id: str, approver_id: str, action_taken: str
    ) -> bool:
        """
        Xử lý khi người dùng bấm [Phê duyệt] hoặc [Hủy bỏ].
        """
        cmd = await self.ai_command_repo.get_command_by_id(cmd_id, for_update=True)

        if not cmd or cmd["status"] != "PENDING_APPROVAL":
            return False

        is_approved = False
        if action_taken == "reject":
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, status="REJECTED"
            )
            await self.ai_command_repo.commit()
            return True

        if cmd["effect"] == "critical":
            if not cmd["approved_by"]:
                await self.ai_command_repo.update_command_approval(
                    cmd_id=cmd_id, approved_by=approver_id
                )
                await self.ai_command_repo.commit()
                return True
            elif str(cmd["approved_by"]) != str(approver_id):
                await self.ai_command_repo.update_command_approval(
                    cmd_id=cmd_id, second_approver=approver_id, status="APPROVED"
                )
                await self.ai_command_repo.commit()
                is_approved = True
            else:
                return False
        else:
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, approved_by=approver_id, status="APPROVED"
            )
            await self.ai_command_repo.commit()
            is_approved = True

        if is_approved:
            try:
                webhook_url = self.n8n_adapter.build_webhook_url(cmd["action"])
                await self.n8n_adapter.trigger_webhook(
                    webhook_url=webhook_url, payload=cmd["parameters"]
                )
            except Exception as e:
                logger.error(
                    f"Failed to trigger n8n after approval for command {cmd_id}: {e}"
                )

        return True

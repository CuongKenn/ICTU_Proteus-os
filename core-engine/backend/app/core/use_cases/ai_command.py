# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — AI Command Executor
# Xử lý DX-DSL actions với các effect: read, write, critical.
# Tham chiếu: docs/dsl-spec.md §4, AGENTS.md §4 (Human-in-the-loop)

import json
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from app.adapters.repositories.base import (
    AbstractAICommandRepository,
    AbstractDSLDryRunRepository,
    AbstractPluginRepository,
)
from app.adapters.repositories.role_repo import RoleRepository
from app.core.domain.entities import AICommandStatus, TenantContext
from app.core.domain.ports import AbstractChatOpsPort, AbstractWorkflowEnginePort
from app.core.use_cases.dsl_dry_run import DSLDryRunEngine
from app.core.use_cases.dsl_validator import DSLValidationError, DSLValidator
from app.infrastructure.config import settings


@dataclass
class AICommandDTO:
    command_id: uuid.UUID
    session_id: uuid.UUID
    dsl_version: str
    action: str
    effect: str
    parameters: dict[str, Any]
    approval_message: str | None = None


logger = structlog.get_logger(__name__)


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
        self.dry_run_engine = DSLDryRunEngine(dry_run_repo=dsl_dry_run_repo)

    async def execute(
        self, body: AICommandDTO, ctx: TenantContext
    ) -> tuple[AICommandStatus, str, dict | None]:
        """
        Thực thi lệnh. Trả về (status, message, result).
        """
        # 1. Validate DSL theo dsl-spec.md
        dsl_validator = DSLValidator(
            plugin_repo=self.plugin_repo,
            role_repo=self.role_repo,
            tenant_id=str(ctx.tenant_id),
            user_id=str(ctx.user_id),
        )

        try:
            await dsl_validator.validate(dsl_payload=asdict(body))
        except DSLValidationError as e:
            # Lưu lỗi vào log và trả về user-friendly message
            logger.warning(f"AI Command Validation Failed: {e}")

            # Ghi lịch sử lệnh bị fail do validation
            now = datetime.now(UTC)
            await self.ai_command_repo.create_command(
                {
                    "id": body.command_id,
                    "tenant_id": ctx.tenant_id,
                    "issued_by_user_id": ctx.user_id,
                    "session_id": body.session_id,
                    "dsl_payload": json.dumps(
                        {
                            "command_id": str(body.command_id),
                            "session_id": str(body.session_id),
                            "dsl_version": body.dsl_version,
                            "action": body.action,
                            "effect": body.effect,
                            "parameters": body.parameters,
                            "approval_message": body.approval_message,
                        },
                        default=str,
                    ),
                    "action": body.action,
                    "effect": body.effect,
                    "status": AICommandStatus.FAILED.value,
                    "execution_result": json.dumps({"error": str(e)}, default=str),
                    "executed_at": now,
                    "created_at": now,
                }
            )
            return AICommandStatus.FAILED, f"Từ chối thực hiện: {str(e)}", None

        now = datetime.now(UTC)

        # 2. Xử lý theo effect
        if body.effect == "read":
            # Lệnh Read → Gửi n8n execute lập tức (vì là webhook trigger proxy)
            try:
                webhook_url = self.n8n_adapter.build_webhook_url(body.action)
                response = await self.n8n_adapter.trigger_webhook(
                    webhook_url=webhook_url,
                    payload=json.loads(json.dumps(asdict(body), default=str)),
                )

                # Lưu DB ngay
                await self.ai_command_repo.create_command(
                    {
                        "id": body.command_id,
                        "tenant_id": ctx.tenant_id,
                        "issued_by_user_id": ctx.user_id,
                        "session_id": body.session_id,
                        "dsl_payload": json.dumps(
                            {
                                "command_id": str(body.command_id),
                                "session_id": str(body.session_id),
                                "dsl_version": body.dsl_version,
                                "action": body.action,
                                "effect": body.effect,
                                "parameters": body.parameters,
                                "approval_message": body.approval_message,
                            },
                            default=str,
                        ),
                        "action": body.action,
                        "effect": body.effect,
                        "status": AICommandStatus.COMPLETED.value,
                        "execution_result": (
                            json.dumps(response, default=str)
                            if response is not None
                            else None
                        ),
                        "executed_at": now,
                        "created_at": now,
                    }
                )
                await self.ai_command_repo.commit()
                logger.info(
                    "Read command executed successfully",
                    ai_command="true",
                    action=body.action,
                    effect=body.effect,
                    tenant_id=ctx.tenant_id,
                )
                # Hỗ trợ hiển thị Markdown đẹp trên giao diện nếu Plugin trả về
                result_data = (
                    response.get("markdown")
                    if isinstance(response, dict) and "markdown" in response
                    else response
                )
                return (
                    AICommandStatus.COMPLETED,
                    "Lệnh đọc dữ liệu đã thực thi thành công.",
                    result_data,
                )
            except Exception as e:
                logger.error(
                    "Read command execution failed",
                    error=str(e),
                    ai_command="true",
                    action=body.action,
                    effect=body.effect,
                    tenant_id=ctx.tenant_id,
                )
                # Ghi log thất bại
                await self.ai_command_repo.create_command(
                    {
                        "id": body.command_id,
                        "tenant_id": ctx.tenant_id,
                        "issued_by_user_id": ctx.user_id,
                        "session_id": body.session_id,
                        "dsl_payload": json.dumps(
                            {
                                "command_id": str(body.command_id),
                                "session_id": str(body.session_id),
                                "dsl_version": body.dsl_version,
                                "action": body.action,
                                "effect": body.effect,
                                "parameters": body.parameters,
                                "approval_message": body.approval_message,
                            },
                            default=str,
                        ),
                        "action": body.action,
                        "effect": body.effect,
                        "status": AICommandStatus.FAILED.value,
                        "execution_result": json.dumps({"error": str(e)}, default=str),
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
            dry_run_res = await self.dry_run_engine.execute_dry_run(
                tenant_id=str(ctx.tenant_id),
                dsl_payload={"action": body.action, "effect": body.effect},
            )
        except Exception:
            dry_run_res = {"preview": "Không thể thực hiện dry run"}

        dry_run_res["action"] = body.action
        dry_run_res["effect"] = body.effect

        # Lưu DB
        await self.ai_command_repo.create_command(
            {
                "id": body.command_id,
                "tenant_id": ctx.tenant_id,
                "issued_by_user_id": ctx.user_id,
                "session_id": body.session_id,
                "dsl_payload": json.dumps(
                    {
                        "command_id": str(body.command_id),
                        "session_id": str(body.session_id),
                        "dsl_version": body.dsl_version,
                        "action": body.action,
                        "effect": body.effect,
                        "parameters": body.parameters,
                        "approval_message": body.approval_message,
                    },
                    default=str,
                ),
                "action": body.action,
                "effect": body.effect,
                "status": AICommandStatus.PENDING_APPROVAL.value,
                "approval_deadline": approval_deadline,
                "dry_run_result": (
                    json.dumps(dry_run_res, default=str)
                    if dry_run_res is not None
                    else None
                ),
                "created_at": now,
            }
        )
        await self.ai_command_repo.commit()
        logger.info(
            "AI command pending approval",
            ai_command="true",
            action=body.action,
            effect=body.effect,
            tenant_id=ctx.tenant_id,
        )

        # Gửi thông báo phê duyệt qua Mattermost
        action_code = f"`{body.action}`"
        msg_text = (
            f"**[AI Command Approval Required]**\n"
            f"- **Action:** {action_code}\n"
            f"- **Mô tả:** {body.approval_message or 'Không có mô tả'}\n"
            f"- **User:** {ctx.user_id}\n"
            f"- **Deadline:** {deadline_minutes} phút\n"
        )
        try:
            await self.mattermost_adapter.send_interactive_message(
                channel_id=settings.MATTERMOST_SYSTEM_CHANNEL_ID,
                text=msg_text,
                action_id=str(body.command_id),
            )
        except Exception as e:
            logger.warning(
                "Could not send Mattermost approval request",
                error=str(e),
                ai_command="true",
                action=body.action,
                effect=body.effect,
                tenant_id=ctx.tenant_id,
            )

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

        if (
            cmd.get("approval_deadline")
            and datetime.now(UTC) > cmd["approval_deadline"]
        ):
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, status="TIMEOUT"
            )
            await self.ai_command_repo.commit()
            return False

        is_approved = False
        if action_taken == "reject":
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, status="REJECTED"
            )
            await self.ai_command_repo.commit()
            return True

        if cmd["effect"] == "critical":
            if not cmd.get("approved_by"):
                # Ghi nhận lần duyệt 1 (Mattermost user ID không insert vào UUID column được)
                await self.ai_command_repo.update_command_approval(cmd_id=cmd_id)
                await self.ai_command_repo.commit()
                return True
            else:
                # Ghi nhận lần duyệt 2
                await self.ai_command_repo.update_command_approval(
                    cmd_id=cmd_id, status="APPROVED"
                )
                await self.ai_command_repo.commit()
                is_approved = True
        else:
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, status="APPROVED"
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
                    "Failed to trigger n8n after approval for command %s: %s",
                    cmd_id,
                    e,
                )

        return True

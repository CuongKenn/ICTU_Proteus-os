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
        manifest_parser=None,
        qdrant_adapter=None,
        audit_log_repo=None,
        user_repo=None,
    ):
        self.plugin_repo = plugin_repo
        self.ai_command_repo = ai_command_repo
        self.dsl_dry_run_repo = dsl_dry_run_repo
        self.role_repo = role_repo
        self.mattermost_adapter = mattermost_adapter
        self.n8n_adapter = n8n_adapter
        self.manifest_parser = manifest_parser
        self.qdrant_adapter = qdrant_adapter
        self.audit_log_repo = audit_log_repo
        self.user_repo = user_repo
        self.dry_run_engine = DSLDryRunEngine(dry_run_repo=dsl_dry_run_repo)

    async def _audit(
        self,
        tenant_id,
        actor_type: str,
        action: str,
        command_id,
        metadata: dict | None = None,
    ) -> None:
        """Ghi audit best-effort (không bao giờ chặn luồng lệnh)."""
        if self.audit_log_repo is None:
            return
        try:
            await self.audit_log_repo.insert_log(
                tenant_id=tenant_id,
                actor_type=actor_type,
                action=action,
                resource_type="AI_COMMAND",
                resource_id=command_id,
                command_id=command_id,
                metadata_json=json.dumps(metadata or {}, default=str),
            )
        except Exception as e:
            logger.warning("Ghi audit AI thất bại (best-effort): %s", e)

    def _resolve_action_url(self, action: str) -> str:
        """Dựng webhook URL cho action 3-part classic hoặc 2-part workflow."""
        from app.core.use_cases.action_catalog import split_plugin_action

        split = split_plugin_action(action)
        if split is not None:
            if self.manifest_parser is None:
                raise ValueError(
                    f"Action '{action}' cần manifest parser để resolve webhook."
                )
            from app.core.use_cases.action_catalog import (
                resolve_workflow_webhook_url,
            )

            plugin_code, workflow_id = split
            return resolve_workflow_webhook_url(
                self.manifest_parser, plugin_code, workflow_id
            )
        return self.n8n_adapter.build_webhook_url(action)

    async def _execute_local_read(
        self, body: AICommandDTO, ctx: TenantContext
    ) -> tuple[bool, Any]:
        """Thực thi local các core read actions (không qua n8n).

        Trả về (handled, result). core.knowledge.search trả kèm citations.
        """
        if body.action == "core.chat.reply":
            # Trả thẳng text (string, không bọc dict) để mọi UI — kể cả bản
            # cũ còn cache — đều render sạch, không dump JSON.
            reply = ((body.parameters or {}).get("reply") or "").strip()
            return True, reply or "Xin chào! Tôi có thể giúp gì cho bạn?"
        if body.action == "core.plugins.list":
            plugins, total = await self.plugin_repo.list_installed(
                tenant_id=ctx.tenant_id
            )
            items = [
                {
                    "code_name": getattr(p, "code_name", None),
                    "display_name": getattr(p, "display_name", None),
                    "status": getattr(getattr(p, "status", None), "value", None)
                    or str(getattr(p, "status", "")),
                }
                for p in plugins
            ]
            lines = "\n".join(
                f"- **{p['display_name'] or p['code_name']}**"
                + (f" (`{p['code_name']}`)" if p["display_name"] else "")
                + f" — {p['status']}"
                for p in items
            )
            return True, {
                "total": total,
                "plugins": items,
                # Quy ước hiển thị: ai_command ưu tiên "markdown" cho UI.
                "markdown": (
                    f"Tổ chức đang có **{total}** plugin:\n{lines}"
                    if items
                    else "Tổ chức chưa cài plugin nào."
                ),
            }
        if body.action == "core.knowledge.search":
            if self.qdrant_adapter is None:
                raise ValueError("RAG chưa cấu hình (thiếu Qdrant adapter).")
            query = (body.parameters or {}).get("raw_input") or (
                body.parameters or {}
            ).get("query", "")
            hits = await self.qdrant_adapter.search(
                tenant_id=str(ctx.tenant_id), query=str(query), limit=5
            )
            citations = [
                {
                    "document": h.get("document"),
                    "score": h.get("score"),
                    "doc_title": (h.get("metadata") or {}).get("doc_title"),
                    "source_url": (h.get("metadata") or {}).get("source_url"),
                }
                for h in hits
            ]
            return True, {"query": query, "citations": citations}
        return False, None

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
            manifest_parser=self.manifest_parser,
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
            await self._audit(
                ctx.tenant_id,
                "USER",
                "ai.command.rejected",
                body.command_id,
                {"action": body.action, "error": str(e)},
            )
            return AICommandStatus.FAILED, f"Từ chối thực hiện: {str(e)}", None

        now = datetime.now(UTC)

        # 2. Xử lý theo effect
        if body.effect == "read":
            # Lệnh Read → core actions chạy local, còn lại qua n8n webhook.
            try:
                handled, local_result = await self._execute_local_read(body, ctx)
                if handled:
                    response = local_result
                else:
                    webhook_url = self._resolve_action_url(body.action)
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
                await self._audit(
                    ctx.tenant_id,
                    "USER",
                    "ai.command.executed",
                    body.command_id,
                    {"action": body.action, "effect": body.effect},
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
                await self._audit(
                    ctx.tenant_id,
                    "USER",
                    "ai.command.failed",
                    body.command_id,
                    {"action": body.action, "error": str(e)},
                )
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
        await self._audit(
            ctx.tenant_id,
            "USER",
            "ai.command.pending",
            body.command_id,
            {"action": body.action, "effect": body.effect},
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

    async def _resolve_approver(self, mm_user_id: str, tenant_id):
        """Map Mattermost user id → UserEntity nội bộ (cùng tenant, còn active).

        Ưu tiên email từ Mattermost API; fallback chấp nhận UUID nội bộ trực
        tiếp (tương thích caller cũ/tests). Trả về None nếu không xác định được.
        """
        if self.user_repo is None:
            return None
        try:
            mm_user = await self.mattermost_adapter.get_user_by_id(mm_user_id)
        except Exception as e:
            logger.warning("Không lấy được MM user %s: %s", mm_user_id, e)
            mm_user = None
        if mm_user and mm_user.get("email"):
            try:
                user = await self.user_repo.get_by_email(tenant_id, mm_user["email"])
                if user is not None and user.is_active:
                    return user
            except Exception as e:
                logger.warning("Lookup user theo email thất bại: %s", e)
        try:
            candidate = await self.user_repo.get(uuid.UUID(str(mm_user_id)))
        except Exception:
            return None
        if (
            candidate is not None
            and str(candidate.tenant_id) == str(tenant_id)
            and candidate.is_active
        ):
            return candidate
        return None

    async def _approver_allowed(self, cmd: dict, approver) -> tuple[bool, str]:
        """Policy duyệt lệnh: đúng người trong tenant + có quyền +
        không tự duyệt + critical cần 2 người khác nhau."""
        from app.core.domain.permissions import has_admin_role

        if approver is None:
            return False, "không xác định được người duyệt trong tổ chức"
        if not has_admin_role(getattr(approver, "roles", [])):
            action = cmd.get("action", "")
            parts = action.split(".")
            perms = await self.role_repo.get_user_permissions(approver.id)
            perms = [str(p) for p in perms or []]
            if len(parts) == 2 and all(parts):
                if not any(p.startswith(f"{parts[0]}:") for p in perms):
                    return False, f"thiếu quyền '{parts[0]}:*'"
            elif len(parts) >= 3:
                req = f"{parts[0]}:{parts[1]}:{parts[2]}"
                if req not in perms:
                    return False, f"thiếu quyền '{req}'"
            else:
                return False, "action không hợp lệ"
        requester = cmd.get("issued_by_user_id") or cmd.get("requested_by")
        if requester is not None and str(requester) == str(approver.id):
            return False, "không được tự duyệt lệnh của chính mình"
        if cmd.get("effect") == "critical":
            first = cmd.get("approved_by")
            if first is not None and str(first) == str(approver.id):
                return False, "lệnh critical cần 2 người duyệt khác nhau"
        return True, ""

    async def process_approval(
        self, cmd_id: str, approver_id: str, action_taken: str
    ) -> str:
        """Xử lý khi người dùng bấm [Phê duyệt] hoặc [Hủy bỏ].

        Trả về: "approved" | "rejected" | "denied" | "invalid".
        """
        cmd = await self.ai_command_repo.get_command_by_id(cmd_id, for_update=True)

        if not cmd or cmd["status"] != "PENDING_APPROVAL":
            return "invalid"

        if (
            cmd.get("approval_deadline")
            and datetime.now(UTC) > cmd["approval_deadline"]
        ):
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, status="TIMEOUT"
            )
            await self.ai_command_repo.commit()
            return "invalid"

        tenant_id = cmd.get("tenant_id")
        approver = await self._resolve_approver(approver_id, tenant_id)
        allowed, reason = await self._approver_allowed(cmd, approver)
        if not allowed:
            logger.warning(
                "Từ chối duyệt lệnh %s bởi %s: %s", cmd_id, approver_id, reason
            )
            await self._audit(
                tenant_id,
                "APPROVER",
                "ai.command.denied",
                cmd_id,
                {
                    "action": cmd.get("action"),
                    "mattermost_user_id": approver_id,
                    "reason": reason,
                },
            )
            return "denied"

        is_approved = False
        if action_taken == "reject":
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, status="REJECTED", approved_by=str(approver.id)
            )
            await self.ai_command_repo.commit()
            await self._audit(
                tenant_id,
                "APPROVER",
                "ai.command.rejected",
                cmd_id,
                {"action": cmd.get("action"), "approver": str(approver.id)},
            )
            return "rejected"

        if cmd["effect"] == "critical":
            if not cmd.get("approved_by"):
                # Ghi nhận lần duyệt 1 (đã resolve được UUID nội bộ).
                await self.ai_command_repo.update_command_approval(
                    cmd_id=cmd_id, approved_by=str(approver.id)
                )
                await self.ai_command_repo.commit()
                return "approved"
            else:
                # Ghi nhận lần duyệt 2 (người khác — đã check ở policy).
                await self.ai_command_repo.update_command_approval(
                    cmd_id=cmd_id,
                    status="APPROVED",
                    second_approver=str(approver.id),
                )
                await self.ai_command_repo.commit()
                is_approved = True
        else:
            await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, status="APPROVED", approved_by=str(approver.id)
            )
            await self.ai_command_repo.commit()
            is_approved = True

        if is_approved:
            await self._audit(
                tenant_id,
                "APPROVER",
                "ai.command.approved",
                cmd_id,
                {"action": cmd.get("action"), "approver": str(approver.id)},
            )
            try:
                webhook_url = self._resolve_action_url(cmd["action"])
                await self.n8n_adapter.trigger_webhook(
                    webhook_url=webhook_url, payload=cmd["parameters"]
                )
            except Exception as e:
                logger.error(
                    "Failed to trigger n8n after approval for command %s: %s",
                    cmd_id,
                    e,
                )

        return "approved"

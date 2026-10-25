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
    dsl_version: str
    action: str
    effect: str
    parameters: dict[str, Any]
    approval_message: str | None = None
    # Chat-memory only — KHÔNG persist vào ai_commands (cột session_id đã
    # bị drop bởi migration 7a6db0254da0). Giữ optional để API cũ vẫn chạy.
    session_id: uuid.UUID | None = None


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
        document_source_port=None,
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
        # Nguồn tri thức (Outline...) cho core.knowledge.save — optional.
        self.document_source_port = document_source_port
        self.dry_run_engine = DSLDryRunEngine(dry_run_repo=dsl_dry_run_repo)

    async def _audit(
        self,
        tenant_id,
        actor_type: str,
        action: str,
        command_id,
        payload: dict | None = None,
        status: str = "success",
        user_id=None,
        result: dict | None = None,
    ) -> None:
        """Ghi audit best-effort (không bao giờ chặn luồng lệnh)."""
        if self.audit_log_repo is None:
            return
        try:
            await self.audit_log_repo.insert_log(
                tenant_id=tenant_id,
                user_id=user_id,
                actor_type=actor_type,
                action=action,
                resource_type="AI_COMMAND",
                resource_id=command_id,
                payload=payload or {},
                result=result,
                status=status,
            )
        except Exception as e:
            logger.warning(
                "Ghi audit AI thất bại (best-effort)",
                error=str(e),
                action=action,
            )

    def _build_command_row(
        self,
        body: AICommandDTO,
        ctx: TenantContext,
        status: str,
        now: datetime,
        execution_result: dict | None = None,
        dry_run_result: dict | None = None,
        approval_deadline: datetime | None = None,
        mattermost_message_id: str | None = None,
    ) -> dict:
        """Dựng dict INSERT theo schema mới (dsl_version/parameters JSONB,
        dry_run_result JSONB, approved_by_user_id/second_approver_id,
        mattermost_message_id). Không ghi session_id / dsl_payload cũ."""
        return {
            "id": body.command_id,
            "tenant_id": ctx.tenant_id,
            "issued_by_user_id": ctx.user_id,
            "dsl_version": body.dsl_version or "1.0",
            "action": body.action,
            "effect": body.effect,
            "parameters": body.parameters or {},
            "status": status,
            "execution_result": execution_result,
            "dry_run_result": dry_run_result,
            "approval_deadline": approval_deadline,
            "mattermost_message_id": mattermost_message_id,
            "created_at": now,
        }

    @staticmethod
    def _wrap_execution_result(response: Any) -> dict | None:
        """Chuẩn hoá response thành dict cho cột execution_result JSONB."""
        if response is None:
            return None
        if isinstance(response, dict):
            return response
        if isinstance(response, str):
            return {"reply": response}
        return {"result": response}

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

    async def _execute_local_write(
        self, body: AICommandDTO, ctx: TenantContext
    ) -> tuple[bool, Any]:
        """Thực thi local core write actions sau khi đã được duyệt.

        Trả về (handled, result). Hiện hỗ trợ core.knowledge.save — publish
        tài liệu lên nguồn tri thức (Outline). Human-in-the-loop: chỉ chạy
        sau bước phê duyệt, không bao giờ tự động.
        """
        if body.action == "core.knowledge.save":
            if self.document_source_port is None:
                raise ValueError(
                    "Chưa cấu hình nguồn tri thức (Outline) để lưu tài liệu."
                )
            params = body.parameters or {}
            title = str(params.get("title") or "").strip()
            text = str(params.get("text") or params.get("content") or "").strip()
            if not title or not text:
                # LLM thường chỉ trả raw_input → parse best-effort để vẫn lưu
                # được thay vì chặn cứng (đã qua phê duyệt của con người).
                raw = str(params.get("raw_input") or "").strip()
                p_title, p_text = self._parse_save_from_raw(raw)
                title = title or p_title
                text = text or p_text
            if not title or not text:
                raise ValueError("Thiếu 'title' hoặc 'text' để lưu tài liệu.")
            doc = await self.document_source_port.publish_document(
                title=title,
                text=text,
                collection_id=params.get("collection_id"),
                parent_document_id=params.get("parent_document_id"),
            )
            doc["markdown"] = (
                f"📄 Đã lưu tài liệu **{doc.get('title') or title}** lên tri thức.\n"
                + (f"Xem tại: {doc.get('url')}" if doc.get("url") else "")
            )
            return True, doc
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
            logger.warning("AI Command validation failed", error=str(e))

            # Ghi lịch sử lệnh bị fail do validation (schema mới)
            now = datetime.now(UTC)
            await self.ai_command_repo.create_command(
                self._build_command_row(
                    body,
                    ctx,
                    AICommandStatus.FAILED.value,
                    now=now,
                    execution_result={"error": str(e)},
                )
            )
            await self._audit(
                ctx.tenant_id,
                "HUMAN",
                "ai.command.rejected",
                body.command_id,
                payload={"action": body.action, "error": str(e)},
                status="failed",
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

                # Lưu DB ngay (schema mới: parameters/dry_run JSONB)
                await self.ai_command_repo.create_command(
                    self._build_command_row(
                        body,
                        ctx,
                        AICommandStatus.COMPLETED.value,
                        now=now,
                        execution_result=self._wrap_execution_result(response),
                    )
                )
                await self.ai_command_repo.commit()
                logger.info(
                    "Read command executed successfully",
                    ai_command="true",
                    action=body.action,
                    effect=body.effect,
                    tenant_id=str(ctx.tenant_id),
                )
                await self._audit(
                    ctx.tenant_id,
                    "HUMAN",
                    "ai.command.executed",
                    body.command_id,
                    payload={"action": body.action, "effect": body.effect},
                    status="success",
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
                    tenant_id=str(ctx.tenant_id),
                )
                # Ghi log thất bại
                await self.ai_command_repo.create_command(
                    self._build_command_row(
                        body,
                        ctx,
                        AICommandStatus.FAILED.value,
                        now=now,
                        execution_result={"error": str(e)},
                    )
                )
                await self.ai_command_repo.commit()
                await self._audit(
                    ctx.tenant_id,
                    "HUMAN",
                    "ai.command.failed",
                    body.command_id,
                    payload={"action": body.action, "error": str(e)},
                    status="failed",
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

        # Lưu DB (schema mới)
        await self.ai_command_repo.create_command(
            self._build_command_row(
                body,
                ctx,
                AICommandStatus.PENDING_APPROVAL.value,
                now=now,
                dry_run_result=dry_run_res,
                approval_deadline=approval_deadline,
            )
        )
        await self.ai_command_repo.commit()
        logger.info(
            "AI command pending approval",
            ai_command="true",
            action=body.action,
            effect=body.effect,
            tenant_id=str(ctx.tenant_id),
        )
        await self._audit(
            ctx.tenant_id,
            "HUMAN",
            "ai.command.pending",
            body.command_id,
            payload={"action": body.action, "effect": body.effect},
            status="pending",
        )

        # Gửi thông báo phê duyệt qua Mattermost:
        # ưu tiên bot nhắn RIÊNG (DM) cho từng người có quyền duyệt,
        # fallback về channel chung nếu không DM được ai.
        action_code = f"`{body.action}`"
        msg_text = (
            f"**[AI Command Approval Required]**\n"
            f"- **Action:** {action_code}\n"
            f"- **Mô tả:** {body.approval_message or 'Không có mô tả'}\n"
            f"- **User:** {ctx.user_id}\n"
            f"- **Deadline:** {deadline_minutes} phút\n"
        )
        try:
            message_id = await self._send_approval_requests(body, ctx, msg_text)
            # Lưu mattermost_message_id best-effort (cột mới, không chặn luồng).
            if message_id:
                try:
                    await self.ai_command_repo.update_command_approval(
                        cmd_id=body.command_id,
                        mattermost_message_id=str(message_id),
                    )
                    await self.ai_command_repo.commit()
                except Exception as update_err:
                    logger.warning(
                        "Lưu mattermost_message_id thất bại (best-effort)",
                        error=str(update_err),
                        command_id=str(body.command_id),
                    )
        except Exception as e:
            logger.warning(
                "Could not send Mattermost approval request",
                error=str(e),
                ai_command="true",
                action=body.action,
                effect=body.effect,
                tenant_id=str(ctx.tenant_id),
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
            logger.warning(
                "Không lấy được Mattermost user",
                mm_user_id=str(mm_user_id),
                error=str(e),
            )
            mm_user = None
        if mm_user and mm_user.get("email"):
            try:
                user = await self.user_repo.get_by_email(tenant_id, mm_user["email"])
                if user is not None and user.is_active:
                    return user
            except Exception as e:
                logger.warning("Lookup user theo email thất bại", error=str(e))
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
        from app.core.domain.permissions import (
            has_admin_role,
            has_wildcard_permission,
        )

        if approver is None:
            return False, "không xác định được người duyệt trong tổ chức"
        if not has_admin_role(getattr(approver, "roles", [])):
            action = cmd.get("action", "")
            parts = action.split(".")
            perms = await self.role_repo.get_user_permissions(approver.id)
            perms = [str(p) for p in perms or []]
            if has_wildcard_permission(perms):
                pass
            elif len(parts) == 2 and all(parts):
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
            first = cmd.get("approved_by_user_id") or cmd.get("approved_by")
            if first is not None and str(first) == str(approver.id):
                return False, "lệnh critical cần 2 người duyệt khác nhau"
        return True, ""

    async def _can_user_approve(self, user, action: str) -> bool:
        """Check 1 user có đủ quyền duyệt action không (bỏ qua self-check).

        Dùng để tìm danh sách người nhận DM phê duyệt: admin bypass,
        còn lại check permission theo action (2-part: `mod:*`, 3+-part:
        `mod:res:act`), wildcard `*` pass hết.
        """
        from app.core.domain.permissions import (
            has_admin_role,
            has_wildcard_permission,
        )

        if user is None or not getattr(user, "is_active", True):
            return False
        if has_admin_role(list(getattr(user, "roles", []) or [])):
            return True
        try:
            perms = await self.role_repo.get_user_permissions(user.id)
        except Exception as e:
            logger.warning(
                "Không lấy được permissions khi tìm người duyệt",
                user_id=str(getattr(user, "id", "?")),
                error=str(e),
            )
            return False
        perms = [str(p) for p in perms or []]
        if has_wildcard_permission(perms):
            return True
        parts = (action or "").split(".")
        if len(parts) == 2 and all(parts):
            return any(p.startswith(f"{parts[0]}:") for p in perms)
        if len(parts) >= 3:
            req = f"{parts[0]}:{parts[1]}:{parts[2]}"
            return req in perms
        return False

    async def _find_eligible_approvers(
        self, tenant_id, action: str, requester_id, limit: int = 10
    ) -> list:
        """Liệt kê users trong tenant đủ quyền duyệt (loại người ra lệnh).

        Trả [] khi thiếu user_repo/role_repo hoặc lỗi DB — caller sẽ
        fallback về channel chung như hành vi cũ.
        """
        if self.user_repo is None or self.role_repo is None:
            return []
        try:
            users = await self.user_repo.list_by_tenant(tenant_id, limit=100)
        except Exception as e:
            logger.warning(
                "Không liệt kê được users để gửi DM phê duyệt",
                tenant_id=str(tenant_id),
                error=str(e),
            )
            return []
        eligible = []
        for u in users or []:
            try:
                if not getattr(u, "is_active", True):
                    continue
                if str(getattr(u, "id", "")) == str(requester_id):
                    continue
                if await self._can_user_approve(u, action):
                    eligible.append(u)
                    if len(eligible) >= limit:
                        break
            except Exception:
                continue
        return eligible

    async def _send_approval_requests(
        self, body: AICommandDTO, ctx: TenantContext, msg_text: str
    ) -> str | None:
        """Gửi yêu cầu phê duyệt: ưu tiên DM riêng, fallback channel chung.

        - Với mỗi eligible approver: resolve MM user qua email →
          `send_direct_interactive_message` (bot nhắn riêng, kèm nút
          Phê duyệt/Từ chối).
        - Luôn best-effort gửi thêm 1 tin vào MATTERMOST_SYSTEM_CHANNEL_ID
          (nếu có cấu hình) để cả team cùng thấy.
        - Trả về message_id đầu tiên thành công (để lưu DB) hoặc None.

        Lý do phải DM: tin bắn vào 1 channel chung thường không tới được
        người duyệt vì (1) CHANNEL_ID trống/sai, (2) bot chưa join channel
        → 403, (3) người duyệt không phải member của channel đó / khác
        team. DM qua /channels/direct luôn tới đúng người.
        """
        first_message_id: str | None = None
        dm_ok = 0
        dm_fail = 0

        eligible: list = []
        try:
            eligible = await self._find_eligible_approvers(
                ctx.tenant_id, body.action, ctx.user_id
            )
        except Exception as e:
            logger.warning("Tìm người duyệt để DM thất bại", error=str(e))

        for approver in eligible:
            email = (getattr(approver, "email", "") or "").strip()
            if not email:
                continue
            try:
                get_by_email = getattr(
                    self.mattermost_adapter, "get_user_by_email", None
                )
                send_dm = getattr(
                    self.mattermost_adapter,
                    "send_direct_interactive_message",
                    None,
                )
                if get_by_email is None or send_dm is None:
                    break
                mm_user = await get_by_email(email)
                if not mm_user or not mm_user.get("id"):
                    dm_fail += 1
                    logger.warning(
                        "Không tìm thấy Mattermost user cho người duyệt, " "bỏ qua DM",
                        email=email,
                        tenant_id=str(ctx.tenant_id),
                    )
                    continue
                mid = await send_dm(
                    mm_user["id"],
                    msg_text,
                    str(body.command_id),
                    extra_context={"tenant_id": str(ctx.tenant_id)},
                )
                if mid:
                    dm_ok += 1
                    if not first_message_id:
                        first_message_id = mid
                    logger.info(
                        "Đã DM yêu cầu phê duyệt tới người duyệt",
                        command_id=str(body.command_id),
                        email=email,
                    )
                else:
                    dm_fail += 1
            except Exception as e:
                dm_fail += 1
                logger.warning(
                    "DM phê duyệt thất bại (best-effort)",
                    email=email,
                    error=str(e),
                    command_id=str(body.command_id),
                )

        # Broadcast/fallback vào channel chung (hành vi cũ, best-effort).
        channel_id = settings.MATTERMOST_SYSTEM_CHANNEL_ID
        if channel_id:
            try:
                mid = await self.mattermost_adapter.send_interactive_message(
                    channel_id=channel_id,
                    text=msg_text,
                    action_id=str(body.command_id),
                    extra_context={"tenant_id": str(ctx.tenant_id)},
                )
                if mid and not first_message_id:
                    first_message_id = mid
            except Exception as e:
                logger.error(
                    "Gửi approval vào channel chung thất bại: %s. "
                    "Kiểm tra: MATTERMOST_BOT_TOKEN có đúng không, bot đã "
                    "join channel %s chưa, CHANNEL_ID có đúng không. "
                    "DM riêng thành công: %d, thất bại: %d.",
                    e,
                    channel_id,
                    dm_ok,
                    dm_fail,
                )
        else:
            if dm_ok == 0:
                logger.error(
                    "Không gửi được approval Mattermost: "
                    "MATTERMOST_SYSTEM_CHANNEL_ID trống và không DM được "
                    "cho ai (DM ok=0, fail=%d, eligible=%d). Kiểm tra "
                    "MATTERMOST_BOT_TOKEN và email Mattermost của người duyệt.",
                    dm_fail,
                    len(eligible),
                )
            else:
                logger.info(
                    "Bỏ qua channel chung (chưa cấu hình) vì đã DM riêng "
                    "thành công tới %d người duyệt.",
                    dm_ok,
                )

        if dm_ok == 0 and not first_message_id:
            logger.warning(
                "Yêu cầu phê duyệt chưa tới được Mattermost của ai "
                "(DM ok=0, channel message=%s). Người duyệt vẫn có thể duyệt "
                "trên web UI.",
                first_message_id,
            )
        return first_message_id

    @staticmethod
    def _parse_save_from_raw(raw: str) -> tuple[str, str]:
        """Parse title/text từ câu lệnh tự nhiên (fallback cho LLM).

        Hỗ trợ dạng: ... tiêu đề 'X' ... nội dung 'Y'.
        Trả ("", "") nếu không tách được.
        """
        import re

        if not raw:
            return "", ""
        title = ""
        text = ""
        m_title = re.search(
            r"(?:tiêu đề|title)\s*(?:là)?\s*[:\-]?\s*['\"“”]([^'\"“”]+)['\"“”]",
            raw,
            re.IGNORECASE,
        )
        m_text = re.search(
            r"(?:nội dung|content)\s*(?:là)?\s*[:\-]?\s*['\"“”]([^'\"“”]+)['\"“”]",
            raw,
            re.IGNORECASE,
        )
        if m_title:
            title = m_title.group(1).strip()
        if m_text:
            text = m_text.group(1).strip()
        if not title:
            m = re.search(r"tài liệu\s+['\"“”]([^'\"“”]+)['\"“”]", raw, re.IGNORECASE)
            if m:
                title = m.group(1).strip()
        return title, text or title

    @staticmethod
    def _extract_parameters(cmd: dict) -> dict:
        """Backward-compat đọc parameters: ưu tiên cột parameters JSONB mới,
        fallback parse từ dsl_payload cũ (DB chưa migrate)."""
        params = cmd.get("parameters")
        if isinstance(params, dict):
            return params
        if params is not None:
            return params if isinstance(params, dict) else {}
        raw = cmd.get("dsl_payload")
        if raw is None:
            return {}
        try:
            payload = json.loads(raw) if isinstance(raw, str) else raw
            parsed = (payload or {}).get("parameters", {})
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, TypeError, AttributeError):
            return {}

    async def cancel_own_command(self, cmd_id: str, user_id: str) -> str:
        """Người ra lệnh tự hủy lệnh PENDING của mình (nút Huỷ trên chat).

        Trả về: "cancelled" | "denied" | "invalid". Dùng REJECTED (enum hiện
        tại không có CANCELLED), kèm audit ghi rõ người hủy.
        """
        cmd = await self.ai_command_repo.get_command_by_id(cmd_id, for_update=True)
        if not cmd or cmd["status"] != "PENDING_APPROVAL":
            return "invalid"
        tenant_id = cmd.get("tenant_id")
        requester = cmd.get("issued_by_user_id") or cmd.get("requested_by")
        me = None
        if self.user_repo is not None:
            try:
                entity = await self.user_repo.get(uuid.UUID(str(user_id)))
                if entity is not None and str(entity.tenant_id) == str(tenant_id):
                    me = entity
            except Exception:
                me = None
            if me is None:
                try:
                    entity = await self.user_repo.get_by_keycloak_id(
                        uuid.UUID(str(user_id))
                    )
                    if entity is not None and str(entity.tenant_id) == str(tenant_id):
                        me = entity
                except Exception:
                    me = None
        if me is None:
            return "denied"
        internal_id = str(me.id)
        if requester is not None and str(requester) != internal_id:
            # Không phải người ra lệnh: vẫn cho hủy nếu có quyền duyệt.
            allowed, _ = await self._approver_allowed(cmd, me)
            if not allowed:
                return "denied"
        rowcount = await self.ai_command_repo.update_command_approval(
            cmd_id=cmd_id, status="REJECTED", approved_by_user_id=internal_id
        )
        if rowcount == 0:
            # Race: lệnh vừa được duyệt/hết hạn bởi luồng khác.
            await self.ai_command_repo.rollback()
            return "invalid"
        await self.ai_command_repo.commit()
        await self._audit(
            tenant_id,
            "HUMAN",
            "ai.command.rejected",
            cmd_id,
            payload={
                "action": cmd.get("action"),
                "cancelled_by": internal_id,
                "via": "chat_cancel",
            },
            status="success",
        )
        return "cancelled"

    async def process_approval(
        self, cmd_id: str, approver_id: str, action_taken: str
    ) -> str:
        """Xử lý khi người dùng bấm [Phê duyệt] hoặc [Hủy bỏ].

        Trả về: "approved" | "partially_approved" | "rejected" | "denied" | "invalid".
        - critical lượt 1 → "partially_approved" (chờ lượt 2, KHÔNG báo approved sớm).
        - n8n trigger fail → chuyển FAILED + raise (không return "approved" giả).

        Chống race: get_command_by_id(for_update=True) + UPDATE conditional
        WHERE status='PENDING_APPROVAL' AND deadline còn hạn, check rowcount.
        Caller phải dùng session transactional để SELECT FOR UPDATE và UPDATE
        nằm cùng transaction (xem get_ai_command_repo).

        NOTE outbox/retry: chưa có bảng outbox — n8n trigger hiện là fire-and-
        forget sau APPROVED; nếu cần exactly-once, bổ sung bảng ai_command_outbox
        + worker retry (TODO).
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
                "Từ chối duyệt lệnh",
                command_id=str(cmd_id),
                approver=str(approver_id),
                reason=reason,
            )
            await self._audit(
                tenant_id,
                "HUMAN",
                "ai.command.denied",
                cmd_id,
                payload={
                    "action": cmd.get("action"),
                    "mattermost_user_id": approver_id,
                    "reason": reason,
                },
                status="failed",
            )
            return "denied"

        if action_taken == "reject":
            rowcount = await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id,
                status="REJECTED",
                approved_by_user_id=str(approver.id),
            )
            if rowcount == 0:
                await self.ai_command_repo.rollback()
                return "invalid"
            await self.ai_command_repo.commit()
            await self._audit(
                tenant_id,
                "HUMAN",
                "ai.command.rejected",
                cmd_id,
                payload={"action": cmd.get("action"), "approver": str(approver.id)},
                status="success",
            )
            return "rejected"

        first_approver = cmd.get("approved_by_user_id") or cmd.get("approved_by")
        if cmd["effect"] == "critical" and not first_approver:
            # Lượt 1 của critical: ghi nhận, giữ PENDING, báo chờ lượt 2.
            rowcount = await self.ai_command_repo.update_command_approval(
                cmd_id=cmd_id, approved_by_user_id=str(approver.id)
            )
            if rowcount == 0:
                await self.ai_command_repo.rollback()
                return "invalid"
            await self.ai_command_repo.commit()
            await self._audit(
                tenant_id,
                "HUMAN",
                "ai.command.partially_approved",
                cmd_id,
                payload={
                    "action": cmd.get("action"),
                    "approver": str(approver.id),
                    "round": 1,
                },
                status="pending",
            )
            return "partially_approved"

        # Lượt cuối (write, hoặc critical lượt 2): chuyển APPROVED có guard.
        second_id = str(approver.id) if cmd["effect"] == "critical" else None
        rowcount = await self.ai_command_repo.update_command_approval(
            cmd_id=cmd_id,
            status="APPROVED",
            approved_by_user_id=(
                str(first_approver)
                if cmd["effect"] == "critical" and first_approver
                else str(approver.id)
            ),
            second_approver_id=second_id,
        )
        if rowcount == 0:
            # Race lost: luồng khác đã duyệt/hủy/hết hạn trước.
            await self.ai_command_repo.rollback()
            return "invalid"
        await self.ai_command_repo.commit()
        await self._audit(
            tenant_id,
            "HUMAN",
            "ai.command.approved",
            cmd_id,
            payload={"action": cmd.get("action"), "approver": str(approver.id)},
            status="success",
        )
        try:
            params = self._extract_parameters(cmd)
            # Core write actions chạy local (không có webhook n8n).
            handled = False
            if str(cmd.get("action", "")).startswith("core."):
                local_body = AICommandDTO(
                    command_id=cmd_id,
                    session_id=cmd.get("session_id") or uuid.uuid4(),
                    dsl_version=cmd.get("dsl_version") or "1.0",
                    action=cmd["action"],
                    effect=cmd.get("effect") or "write",
                    parameters=params or {},
                )
                handled, local_result = await self._execute_local_write(
                    local_body,
                    TenantContext(
                        tenant_id=tenant_id,
                        user_id=approver.id,
                        roles=list(getattr(approver, "roles", []) or []),
                        email=getattr(approver, "email", "") or "",
                        full_name=getattr(approver, "full_name", "") or "",
                    ),
                )
                if handled:
                    await self.ai_command_repo.update_status(
                        cmd_id, AICommandStatus.COMPLETED
                    )
                    await self.ai_command_repo.commit()
                    await self._audit(
                        tenant_id,
                        "SYSTEM",
                        "ai.command.executed",
                        cmd_id,
                        payload={"action": cmd.get("action")},
                        result=(
                            local_result if isinstance(local_result, dict) else None
                        ),
                        status="success",
                    )
            if not handled:
                webhook_url = self._resolve_action_url(cmd["action"])
                await self.n8n_adapter.trigger_webhook(
                    webhook_url=webhook_url, payload=params or {}
                )
        except Exception as e:
            logger.error(
                "Failed to trigger n8n after approval",
                command_id=str(cmd_id),
                error=str(e),
            )
            # Không báo approved giả: đánh FAILED để worker/retry xử lý.
            try:
                await self.ai_command_repo.update_status(cmd_id, AICommandStatus.FAILED)
                await self.ai_command_repo.commit()
            except Exception as persist_err:
                logger.error(
                    "Persist FAILED sau lỗi n8n thất bại",
                    command_id=str(cmd_id),
                    error=str(persist_err),
                )
                await self.ai_command_repo.rollback()
            await self._audit(
                tenant_id,
                "SYSTEM",
                "ai.command.failed",
                cmd_id,
                payload={"action": cmd.get("action"), "error": str(e)},
                status="failed",
            )
            raise

        return "approved"

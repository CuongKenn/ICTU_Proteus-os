# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Use Case — AI Chat (NL → DX-DSL → execute).
# - Prompt dựng động từ catalog: core tĩnh + workflows webhook của plugin
#   tenant đã cài (action_catalog), fallback 3 actions tĩnh khi thiếu.
# - Gọi LLM ở chế độ JSON (structured output) với fallback gọi thường.
# - Persist memory server-side (best-effort, không chặn chat khi lỗi).
# - execute_stream: SSE pipeline events (started/token/dsl/result).

import json
import logging
import uuid
from dataclasses import dataclass
from typing import Any, AsyncIterator

from app.ai.llm_provider import extract_json_object
from app.core.domain.entities import AICommandStatus
from app.core.domain.ports import AbstractLLMPort
from app.core.use_cases.action_catalog import (
    FALLBACK_PROMPT_ACTIONS,
    build_catalog_for_tenant,
    render_for_prompt,
)
from app.core.use_cases.ai_command import AICommandDTO, AICommandUseCase

logger = logging.getLogger(__name__)


@dataclass
class AIChatDTO:
    session_id: uuid.UUID
    natural_language_input: str


# P0: planner-executor giữ đơn giản cho model nhỏ (llama3 local).
# Plan dài dễ ảo giác → giới hạn steps, validate từng step như lệnh đơn.
MAX_PLAN_STEPS = 4


class AIChatUseCase:
    def __init__(
        self,
        llm_port: AbstractLLMPort,
        ai_command_use_case: AICommandUseCase,
        conversation_repo=None,
        plugin_repo=None,
        manifest_parser=None,
    ):
        self.llm_port = llm_port
        self.ai_command_use_case = ai_command_use_case
        self.conversation_repo = conversation_repo
        self.plugin_repo = plugin_repo
        self.manifest_parser = manifest_parser

    async def _build_messages(self, ctx: dict, user_text: str) -> list[dict[str, str]]:
        try:
            tenant_id = ctx.get("tenant_id") if isinstance(ctx, dict) else getattr(
                ctx, "tenant_id", None
            )
            catalog = await build_catalog_for_tenant(
                self.plugin_repo, self.manifest_parser, tenant_id
            )
        except Exception as e:
            logger.warning("Không dựng được catalog động, dùng fallback: %s", e)
            catalog = []
        action_list = (
            render_for_prompt(catalog) if catalog else FALLBACK_PROMPT_ACTIONS
        )
        system_prompt = f"""Bạn là trợ lý AI (Proteus AI) đóng vai trò là một Orchestrator. Nhiệm vụ của bạn là chuyển đổi câu lệnh ngôn ngữ tự nhiên của người dùng thành một lệnh hệ thống chuẩn DX-DSL.

Bạn CHỈ ĐƯỢC PHÉP trả về một object JSON hợp lệ với 1 trong 2 dạng sau, tuyệt đối không trả lời thêm bất kỳ văn bản nào khác:

Dạng 1 — plan nhiều bước (khi việc cần từ 2 việc trở lên):
{{
  "goal": "<mục tiêu tóm tắt>",
  "steps": [
    {{
      "action": "<tên hành động>",
      "effect": "<read | write | critical>",
      "parameters": {{ "raw_input": "<câu lệnh gốc của người dùng>" }},
      "approval_message": "<tiếng Việt, chỉ dùng khi effect là write hoặc critical, nếu không thì để null>"
    }}
  ]
}}
Tối đa {MAX_PLAN_STEPS} steps. Sắp xếp steps read (tra cứu) TRƯỚC, write/critical SAU.

Dạng 2 — lệnh đơn (việc đơn giản, chỉ 1 hành động):
{{
  "action": "<tên hành động>",
  "effect": "<read | write | critical>",
  "parameters": {{ "raw_input": "<câu lệnh gốc của người dùng>" }},
  "approval_message": "<như trên>"
}}

Danh sách các hành động (action) được hỗ trợ hiện tại:
{action_list}

Quy tắc effect: "read" cho tra cứu/báo cáo (trả lời ngay), "write" cho thay đổi dữ liệu (cần 1 duyệt), "critical" cho xóa/khóa/chuyển khoản (cần 2 duyệt).
Nếu câu lệnh không nằm trong các hành động trên, hãy mặc định trả về hành động tìm kiếm đầu tiên trong danh sách với parameters={{"raw_input": "<câu lệnh gốc>"}}."""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ]

    def _single_fallback(self, dto: AIChatDTO) -> AICommandDTO:
        return AICommandDTO(
            command_id=uuid.uuid4(),
            session_id=dto.session_id,
            dsl_version="1.0",
            action="hr.employees.read",
            effect="read",
            parameters={"raw_input": dto.natural_language_input},
            approval_message=None,
        )

    def _step_from_dict(self, raw: dict, dto: AIChatDTO) -> AICommandDTO | None:
        if not isinstance(raw, dict) or not raw.get("action"):
            return None
        effect = raw.get("effect", "read")
        if effect not in ("read", "write", "critical"):
            effect = "read"
        params = raw.get("parameters")
        if not isinstance(params, dict):
            params = {"raw_input": dto.natural_language_input}
        return AICommandDTO(
            command_id=uuid.uuid4(),
            session_id=dto.session_id,
            dsl_version="1.0",
            action=str(raw["action"]),
            effect=effect,
            parameters=params,
            approval_message=raw.get("approval_message"),
        )

    def _parse_plan(self, content: str, dto: AIChatDTO) -> list[AICommandDTO]:
        """Parse output LLM thành plan (list steps, tối đa MAX_PLAN_STEPS).

        Chấp nhận dạng plan {goal, steps[]} và dạng lệnh đơn legacy {action,...}.
        Parse rớt → 1 step fallback read (không bao giờ vỡ luồng chat).
        """
        try:
            parsed = json.loads(extract_json_object(content.strip()))
        except (ValueError, json.JSONDecodeError):
            logger.warning("LLM output không parse được JSON, dùng fallback read.")
            return [self._single_fallback(dto)]
        if isinstance(parsed, dict) and isinstance(parsed.get("steps"), list):
            steps = []
            for raw in parsed["steps"][:MAX_PLAN_STEPS]:
                step = self._step_from_dict(raw, dto)
                if step is not None:
                    steps.append(step)
            if steps:
                if len(parsed["steps"]) > MAX_PLAN_STEPS:
                    logger.warning(
                        "Plan %d steps vượt giới hạn %d, cắt bớt.",
                        len(parsed["steps"]),
                        MAX_PLAN_STEPS,
                    )
                return steps
        single = self._step_from_dict(parsed, dto) if isinstance(parsed, dict) else None
        return [single or self._single_fallback(dto)]

    def _parse_command(
        self, content: str, dto: AIChatDTO, fallback_effect: str = "read"
    ) -> AICommandDTO:
        plan = self._parse_plan(content, dto)
        return plan[0]

    async def _persist_turn(
        self,
        ctx: Any,
        session_id: uuid.UUID,
        role: str,
        content: str,
        command_id: uuid.UUID | None = None,
        citations: list[dict] | None = None,
    ) -> None:
        if self.conversation_repo is None:
            return
        try:
            tenant_id = (
                ctx.get("tenant_id") if isinstance(ctx, dict) else ctx.tenant_id
            )
            user_id = ctx.get("user_id") if isinstance(ctx, dict) else ctx.user_id
            real_session = await self.conversation_repo.ensure_session(
                tenant_id, user_id, session_id
            )
            await self.conversation_repo.append_message(
                tenant_id, user_id, real_session, role, content, command_id, citations
            )
            await self.conversation_repo.commit()
        except Exception as e:
            logger.warning("Persist memory thất bại (best-effort): %s", e)

    async def _run_plan(
        self,
        plan: list[AICommandDTO],
        dto: AIChatDTO,
        ctx: Any,
        on_step=None,
    ) -> tuple[AICommandStatus, str, dict]:
        """Chạy steps tuần tự, dừng ở PENDING (chờ duyệt) hoặc FAILED.

        Mỗi step vẫn đi qua AICommandUseCase đầy đủ (validate/Z3/audit/duyệt).
        on_step(index, step, status, message) được gọi sau mỗi step (cho SSE).
        """
        outcomes: list[dict[str, Any]] = []
        total = len(plan)
        for i, step in enumerate(plan):
            params = dict(step.parameters or {})
            params["_plan"] = {"index": i + 1, "total": total}
            step.parameters = params
            status, message, result = await self.ai_command_use_case.execute(
                step, ctx
            )
            outcomes.append(
                {
                    "index": i + 1,
                    "command_id": str(step.command_id),
                    "action": step.action,
                    "effect": step.effect,
                    "status": status.value,
                    "message": message,
                    "result": result,
                }
            )
            if on_step is not None:
                maybe = on_step(i, step, status, message)
                if hasattr(maybe, "__await__"):
                    await maybe
            if status != AICommandStatus.COMPLETED:
                break

        done = [o for o in outcomes if o["status"] == AICommandStatus.COMPLETED.value]
        last = outcomes[-1]
        lines = [
            f"{o['index']}. `{o['action']}` — {o['status']}: {o['message']}"
            for o in outcomes
        ]
        if last["status"] == AICommandStatus.COMPLETED.value and len(outcomes) == total:
            summary = f"✅ Hoàn thành plan {total} bước:\n" + "\n".join(lines)
            overall = AICommandStatus.COMPLETED
        elif last["status"] == AICommandStatus.PENDING_APPROVAL.value:
            summary = (
                f"⏳ Xong {len(done)}/{total} bước, dừng ở bước {last['index']} "
                f"(`{last['action']}`): chờ phê duyệt trên Mattermost.\n"
                + "\n".join(lines)
            )
            overall = AICommandStatus.PENDING_APPROVAL
        else:
            summary = (
                f"❌ Dừng ở bước {last['index']}/{total} "
                f"(`{last['action']}`): {last['message']}\n" + "\n".join(lines)
            )
            overall = AICommandStatus.FAILED
        return overall, summary, {"plan_total": total, "steps": outcomes}

    async def execute(
        self, dto: AIChatDTO, ctx: dict
    ) -> tuple[AICommandStatus, str, dict]:
        if not self.llm_port:
            logger.error("LLM Port is not configured. Cannot process AI Chat.")
            return (
                AICommandStatus.FAILED,
                "AI Service Unavailable",
                {"detail": "LLM provider is not configured."},
            )

        messages = await self._build_messages(ctx, dto.natural_language_input)
        logger.info(f"Sending natural language to LLM: {dto.natural_language_input}")

        try:
            if hasattr(self.llm_port, "ainvoke_json"):
                llm_response = await self.llm_port.ainvoke_json(messages)
            else:
                llm_response = await self.llm_port.ainvoke(messages)
            plan = self._parse_plan(llm_response.content, dto)
            await self._persist_turn(
                ctx, dto.session_id, "user", dto.natural_language_input
            )
            status, message, result = await self._run_plan(plan, dto, ctx)
            first_cmd = plan[0].command_id if plan else None
            await self._persist_turn(
                ctx, dto.session_id, "assistant", message, first_cmd
            )
            return status, message, result
        except Exception as e:
            logger.error(f"Error in AIChatUseCase: {str(e)}")
            return AICommandStatus.FAILED, f"Lỗi hệ thống: {str(e)}", {"detail": str(e)}

    async def execute_stream(
        self, dto: AIChatDTO, ctx: dict
    ) -> AsyncIterator[dict[str, Any]]:
        """SSE pipeline events: started → token* → dsl → result."""
        yield {"event": "started", "session_id": str(dto.session_id)}
        if not self.llm_port:
            yield {
                "event": "result",
                "status": AICommandStatus.FAILED.value,
                "message": "AI Service Unavailable",
                "result": {"detail": "LLM provider is not configured."},
            }
            return
        messages = await self._build_messages(ctx, dto.natural_language_input)
        full_text: list[str] = []
        try:
            if hasattr(self.llm_port, "astream"):
                async for delta in self.llm_port.astream(messages):
                    if delta:
                        full_text.append(delta)
                        yield {"event": "token", "delta": delta}
                content = "".join(full_text)
            elif hasattr(self.llm_port, "ainvoke_json"):
                content = (await self.llm_port.ainvoke_json(messages)).content
            else:
                content = (await self.llm_port.ainvoke(messages)).content
        except Exception as e:
            logger.error(f"LLM stream error: {e}")
            yield {
                "event": "result",
                "status": AICommandStatus.FAILED.value,
                "message": f"Lỗi hệ thống: {e}",
                "result": {"detail": str(e)},
            }
            return
        command_dtos = self._parse_plan(content, dto)
        yield {
            "event": "plan",
            "total": len(command_dtos),
            "steps": [
                {"action": c.action, "effect": c.effect} for c in command_dtos
            ],
        }
        await self._persist_turn(
            ctx, dto.session_id, "user", dto.natural_language_input
        )
        step_events: list[dict[str, Any]] = []

        async def _emit(i: int, step: AICommandDTO, status, message: str) -> None:
            step_events.append(
                {
                    "index": i + 1,
                    "command_id": str(step.command_id),
                    "action": step.action,
                    "status": status.value,
                    "message": message,
                }
            )

        try:
            overall, message, result = await self._run_plan(
                command_dtos, dto, ctx, on_step=_emit
            )
        except Exception as e:
            logger.error(f"Error in AIChatUseCase stream: {e}")
            overall, message, result = (
                AICommandStatus.FAILED,
                f"Lỗi hệ thống: {e}",
                {"detail": str(e)},
            )
        for se in step_events:
            yield {"event": "step", **se}
        first_cmd = command_dtos[0].command_id if command_dtos else None
        await self._persist_turn(
            ctx, dto.session_id, "assistant", message, first_cmd
        )
        yield {
            "event": "result",
            "status": overall.value,
            "message": message,
            "result": result,
            "command_id": str(first_cmd) if first_cmd else None,
        }

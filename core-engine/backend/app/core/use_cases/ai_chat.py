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

# P1 ReAct: số vòng nghĩ-lại tối đa SAU step mồi (mỗi vòng = 1 LLM call).
# Tổng ≤ 1 (plan) + MAX_REACT_ITERS calls để vừa timeout BFF (120-180s).
MAX_REACT_ITERS = 2
REACT_TIME_BUDGET_S = 75

# Chitchat và hỏi khả năng do LLM xử lý trực tiếp qua tool core.chat.reply
# (catalog đã nằm trong prompt) — không fast-path regex để model quyết định.
# Fallback khi LLM trả về parse không được: chào an toàn, không chạm dữ liệu.
_FALLBACK_REPLY = (
    "Xin chào! Tôi là Proteus AI. Tôi có thể giúp bạn tra cứu nhân sự, "
    "nghỉ phép, tri thức nội bộ hoặc thực hiện các tác vụ quản trị "
    "(cần phê duyệt). Bạn cần gì?"
)


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

Xử lý hội thoại (dùng "core.chat.reply", parameters.reply TIẾNG VIỆT, xưng "tôi"):
- Chào/cảm ơn/tạm biệt ("xin chào", "hello", "cảm ơn", "bye"...): chào lại thân thiện + gợi ý 1-2 việc có thể làm.
- Được hỏi khả năng ("làm được gì", "tính năng", "bạn là ai"...): LIỆT KÊ từ danh sách actions ở trên (nhóm tra cứu / cần phê duyệt), không bịa thêm action.
- Câu nghiệp vụ không có action phù hợp: giải thích không làm được + gợi ý việc gần nhất.
TUYỆT ĐỐI không gọi action nghiệp vụ cho các câu trên.

Ví dụ:
- Input "xin chào" → {{"action": "core.chat.reply", "effect": "read", "parameters": {{"reply": "Xin chào! Tôi là Proteus AI, trợ lý điều hành của tổ chức bạn. Tôi tra cứu nhân sự, nghỉ phép, tri thức nội bộ hoặc thực hiện tác vụ cần phê duyệt. Bạn cần gì?"}}, "approval_message": null}}
- Input "mày làm được gì" → {{"action": "core.chat.reply", "effect": "read", "parameters": {{"reply": "Tôi có thể giúp bạn:\n🔍 Tra cứu, báo cáo (trả lời ngay): liệt kê plugin, tìm nhân sự, tra tri thức nội bộ...\n⚙️ Thực hiện (cần bạn phê duyệt): duyệt nghỉ phép, cài plugin...\nCứ hỏi cụ thể bằng tiếng Việt nhé!"}}, "approval_message": null}}"""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ]

    def _single_fallback(self, dto: AIChatDTO) -> AICommandDTO:
        """Safety net khi LLM trả về parse không được (không phải fast-path)."""
        return AICommandDTO(
            command_id=uuid.uuid4(),
            session_id=dto.session_id,
            dsl_version="1.0",
            action="core.chat.reply",
            effect="read",
            parameters={"reply": _FALLBACK_REPLY},
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

    def _parse_react(self, content: str) -> tuple[str, dict | None, bool]:
        """Parse 1 vòng ReAct → (thought, next_action_dict|None, finish).

        Chấp nhận {thought, next_action} | {thought, finish:true} |
        legacy {action,...} (1 action rồi dừng). Parse rớt → (thought, None, True).
        """
        try:
            parsed = json.loads(extract_json_object(content.strip()))
        except (ValueError, json.JSONDecodeError):
            logger.warning("ReAct output không parse được, dừng loop.")
            return "", None, True
        if not isinstance(parsed, dict):
            return "", None, True
        thought = str(parsed.get("thought", ""))[:500]
        if parsed.get("finish"):
            return thought, None, True
        raw = parsed.get("next_action")
        if isinstance(raw, dict) and raw.get("action"):
            return thought, raw, False
        if parsed.get("action"):
            return thought, parsed, True
        return thought, None, True

    async def _react_messages(
        self,
        ctx: Any,
        goal: str,
        done: list[dict[str, Any]],
        suggestion: list[AICommandDTO],
    ) -> list[dict[str, str]]:
        """Prompt 1 vòng ReAct: mục tiêu + đã làm + gợi ý + tools."""
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
            render_for_prompt(catalog, limit=40)
            if catalog
            else FALLBACK_PROMPT_ACTIONS
        )

        def _obs_text(o: dict[str, Any]) -> str:
            base = f"{o['status']}: {o['message']}"
            res = o.get("result")
            if o["status"] == AICommandStatus.COMPLETED.value and res:
                try:
                    return base + " | KQ: " + json.dumps(res, default=str)[:500]
                except Exception:
                    return base
            return base

        done_lines = "\n".join(
            f"{o['index']}. `{o['action']}` — {_obs_text(o)}" for o in done
        ) or "(chưa làm gì)"
        sugg_lines = "\n".join(
            f"- `{s.action}` ({s.effect})" for s in suggestion
        ) or "(hết gợi ý — tự quyết định bước tiếp hoặc kết thúc)"
        system = f"""Bạn là Proteus AI đang thực hiện mục tiêu: {goal}

Đã làm xong:
{done_lines}

Gợi ý plan ban đầu còn lại:
{sugg_lines}

Tools khả dụng:
{action_list}

Quy tắc effect: read (trả lời ngay), write (1 duyệt), critical (2 duyệt).
Chào hỏi/linh tinh → dùng "core.chat.reply".
CHỈ trả về JSON, không text thừa:
- Còn việc cần làm: {{"thought": "<suy luận ngắn gọn vì sao chọn bước này>", "next_action": {{"action": "...", "effect": "...", "parameters": {{"raw_input": "{goal}"}}, "approval_message": "..."}}}}
- Xong hoặc không làm thêm được: {{"thought": "<lý do>", "finish": true}}"""
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Tiếp tục mục tiêu: {goal}"},
        ]

    async def _llm_text(self, messages: list[dict[str, str]]) -> str:
        if hasattr(self.llm_port, "ainvoke_json"):
            return (await self.llm_port.ainvoke_json(messages)).content
        return (await self.llm_port.ainvoke(messages)).content

    async def _run_react(
        self,
        seed_plan: list[AICommandDTO],
        dto: AIChatDTO,
        ctx: Any,
        on_event=None,
    ) -> tuple[AICommandStatus, str, dict]:
        """ReAct in-turn: step mồi chạy ngay, các bước sau do LLM quyết định.

        Dừng khi: finish / hết gợi ý+không đề xuất / PENDING (chờ duyệt) /
        FAILED sau khi đã cho LLM cứu 1 lần / hết vòng / hết budget.
        on_event(type, payload) nhận 'thought' | 'step' (cho SSE).
        """
        import time as _time

        async def _emit(etype: str, payload: dict[str, Any]) -> None:
            if on_event is None:
                return
            maybe = on_event(etype, payload)
            if hasattr(maybe, "__await__"):
                await maybe

        outcomes: list[dict[str, Any]] = []
        thoughts: list[str] = []
        total_hint = len(seed_plan)
        t0 = _time.monotonic()

        async def _do_step(index: int, step: AICommandDTO):
            params = dict(step.parameters or {})
            params["_plan"] = {"index": index, "total": total_hint, "react": True}
            step.parameters = params
            status, message, result = await self.ai_command_use_case.execute(
                step, ctx
            )
            outcomes.append(
                {
                    "index": index,
                    "command_id": str(step.command_id),
                    "action": step.action,
                    "effect": step.effect,
                    "status": status.value,
                    "message": message,
                    "result": result,
                }
            )
            await _emit(
                "step",
                {
                    "index": index,
                    "command_id": str(step.command_id),
                    "action": step.action,
                    "status": status.value,
                    "message": message,
                },
            )
            return status

        # Step mồi: chạy ngay không tốn thêm LLM call.
        first, rest = seed_plan[0], seed_plan[1:]
        first_status = await _do_step(1, first)
        if first_status == AICommandStatus.PENDING_APPROVAL:
            # Dừng chờ duyệt: step sau có thể phụ thuộc mutation chưa duyệt.
            return self._summarize(outcomes, total_hint, thoughts)
        if first_status == AICommandStatus.COMPLETED and not rest:
            # Việc đơn xong ngay: khỏi tốn thêm vòng ReAct.
            return self._summarize(outcomes, total_hint, thoughts)
        # FAILED hoặc còn gợi ý: vào loop cho LLM cứu/tiếp tục (giới hạn vòng).

        suggestion = list(rest)
        end_reason = "finish"
        for _ in range(MAX_REACT_ITERS):
            if _time.monotonic() - t0 > REACT_TIME_BUDGET_S:
                logger.warning("ReAct hết budget thời gian, dừng.")
                end_reason = "timeout"
                break
            try:
                react_msgs = await self._react_messages(
                    ctx, dto.natural_language_input, outcomes, suggestion
                )
                thought, raw_next, finish = self._parse_react(
                    await self._llm_text(react_msgs)
                )
            except Exception as e:
                logger.error("ReAct LLM error: %s", e)
                break
            if thought:
                thoughts.append(thought)
                await _emit("thought", {"text": thought})
            if finish or raw_next is None:
                break
            nxt = self._step_from_dict(raw_next, dto)
            if nxt is None:
                break
            suggestion = []
            st = await _do_step(len(outcomes) + 1, nxt)
            if st == AICommandStatus.PENDING_APPROVAL:
                break
            # FAILED: cho LLM 1 cơ hội cứu ở vòng sau (obs đã ghi) —
            # vòng lặp tự kết thúc nhờ MAX_REACT_ITERS.
        else:
            end_reason = "iters"
        return self._summarize(outcomes, total_hint, thoughts, end_reason)

    def _summarize(
        self,
        outcomes: list[dict[str, Any]],
        total_hint: int,
        thoughts: list[str] | None = None,
        end_reason: str = "done",
    ) -> tuple[AICommandStatus, str, dict]:
        """Kết luận 1 turn: COMPLETED nếu bước cuối xong (kèm note khi dừng
        do giới hạn vòng/thời gian), PENDING nếu chờ duyệt, FAILED nếu lỗi."""
        done = [o for o in outcomes if o["status"] == AICommandStatus.COMPLETED.value]
        last = outcomes[-1]
        lines = [
            f"{o['index']}. `{o['action']}` — {o['status']}: {o['message']}"
            for o in outcomes
        ]
        thought_block = ""
        if thoughts:
            thought_block = "\n\n💭 Suy luận:\n" + "\n".join(
                f"- {t[:200]}" for t in thoughts[:3]
            )
        if last["status"] == AICommandStatus.COMPLETED.value:
            # Reply trò chuyện thuần túy: trả thẳng nội dung, bỏ wrapper kỹ thuật
            # để UI nào cũng hiển thị sạch.
            if (
                len(outcomes) == 1
                and outcomes[0].get("action") == "core.chat.reply"
                and isinstance(outcomes[0].get("result"), str)
            ):
                return (
                    AICommandStatus.COMPLETED,
                    outcomes[0]["result"],
                    {"plan_total": total_hint, "steps": outcomes},
                )
            # Việc đơn xong gọn: 1 dòng thay vì liệt kê lại steps.
            if len(outcomes) == 1 and not thoughts:
                summary = f"✅ Đã xong `{last['action']}`."
                overall = AICommandStatus.COMPLETED
                result: dict[str, Any] = {"plan_total": total_hint, "steps": outcomes}
                return overall, summary, result
            note = (
                f" (dừng sau giới hạn vòng lặp, đã xong {len(done)} bước)"
                if end_reason in ("iters", "timeout")
                else ""
            )
            summary = f"✅ Hoàn thành ({len(outcomes)} bước){note}:\n" + "\n".join(
                lines
            )
            overall = AICommandStatus.COMPLETED
        elif last["status"] == AICommandStatus.PENDING_APPROVAL.value:
            summary = (
                f"⏳ Xong {len(done)} bước, dừng ở bước {last['index']} "
                f"(`{last['action']}`): chờ phê duyệt trên Mattermost.\n"
                + "\n".join(lines)
            )
            overall = AICommandStatus.PENDING_APPROVAL
        else:
            summary = (
                f"❌ Dừng ở bước {last['index']} "
                f"(`{last['action']}`): {last['message']}\n" + "\n".join(lines)
            )
            overall = AICommandStatus.FAILED
        result: dict[str, Any] = {"plan_total": total_hint, "steps": outcomes}
        if thoughts:
            result["thoughts"] = thoughts
        return overall, summary + thought_block, result

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
            # Mọi input đều qua LLM (kể cả chào hỏi — prompt đã dạy tool
            # core.chat.reply). Chỉ parse-rớt mới dùng fallback an toàn.
            if hasattr(self.llm_port, "ainvoke_json"):
                llm_response = await self.llm_port.ainvoke_json(messages)
            else:
                llm_response = await self.llm_port.ainvoke(messages)
            plan = self._parse_plan(llm_response.content, dto)
            await self._persist_turn(
                ctx, dto.session_id, "user", dto.natural_language_input
            )
            status, message, result = await self._run_react(plan, dto, ctx)
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

        async def _emit(etype: str, payload: dict[str, Any]) -> None:
            if etype == "thought":
                step_events.append({"thought": True, **payload})
            else:
                step_events.append(payload)

        try:
            overall, message, result = await self._run_react(
                command_dtos, dto, ctx, on_event=_emit
            )
        except Exception as e:
            logger.error(f"Error in AIChatUseCase stream: {e}")
            overall, message, result = (
                AICommandStatus.FAILED,
                f"Lỗi hệ thống: {e}",
                {"detail": str(e)},
            )
        for se in step_events:
            yield {"event": "thought" if se.pop("thought", False) else "step", **se}
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

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

Bạn CHỈ ĐƯỢC PHÉP trả về một object JSON hợp lệ với cấu trúc sau, tuyệt đối không trả lời thêm bất kỳ văn bản nào khác:
{{
  "action": "<tên hành động>",
  "effect": "<read | write | critical>",
  "parameters": {{ "raw_input": "<câu lệnh gốc của người dùng>" }},
  "approval_message": "<Nội dung tin nhắn tóm tắt ngắn gọn yêu cầu bằng tiếng Việt để xin duyệt trên Mattermost, chỉ dùng khi effect là write hoặc critical, nếu không thì để null>"
}}

Danh sách các hành động (action) được hỗ trợ hiện tại:
{action_list}

Quy tắc effect: "read" cho tra cứu/báo cáo (trả lời ngay), "write" cho thay đổi dữ liệu (cần 1 duyệt), "critical" cho xóa/khóa/chuyển khoản (cần 2 duyệt).
Nếu câu lệnh không nằm trong các hành động trên, hãy mặc định trả về hành động tìm kiếm đầu tiên trong danh sách với parameters={{"raw_input": "<câu lệnh gốc>"}}."""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ]

    def _parse_command(
        self, content: str, dto: AIChatDTO, fallback_effect: str = "read"
    ) -> AICommandDTO:
        try:
            parsed = json.loads(extract_json_object(content.strip()))
        except (ValueError, json.JSONDecodeError):
            logger.warning("LLM output không parse được JSON, dùng fallback read.")
            parsed = {}
        return AICommandDTO(
            command_id=uuid.uuid4(),
            session_id=dto.session_id,
            dsl_version="1.0",
            action=parsed.get("action", "hr.employees.read"),
            effect=parsed.get("effect", fallback_effect),
            parameters=parsed.get(
                "parameters", {"raw_input": dto.natural_language_input}
            ),
            approval_message=parsed.get("approval_message", None),
        )

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
            command_dto = self._parse_command(llm_response.content, dto)
            await self._persist_turn(
                ctx, dto.session_id, "user", dto.natural_language_input
            )
            status, message, result = await self.ai_command_use_case.execute(
                command_dto, ctx
            )
            await self._persist_turn(
                ctx, dto.session_id, "assistant", message, command_dto.command_id
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
        command_dto = self._parse_command(content, dto)
        yield {
            "event": "dsl",
            "action": command_dto.action,
            "effect": command_dto.effect,
            "command_id": str(command_dto.command_id),
        }
        await self._persist_turn(
            ctx, dto.session_id, "user", dto.natural_language_input
        )
        try:
            status, message, result = await self.ai_command_use_case.execute(
                command_dto, ctx
            )
        except Exception as e:
            logger.error(f"Error in AIChatUseCase stream: {e}")
            status, message, result = (
                AICommandStatus.FAILED,
                f"Lỗi hệ thống: {e}",
                {"detail": str(e)},
            )
        await self._persist_turn(
            ctx, dto.session_id, "assistant", message, command_dto.command_id
        )
        yield {
            "event": "result",
            "status": status.value,
            "message": message,
            "result": result,
            "command_id": str(command_dto.command_id),
        }

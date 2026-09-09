# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import json
import logging
import uuid
from dataclasses import dataclass

from app.core.domain.entities import AICommandStatus
from app.core.domain.ports import AbstractLLMPort
from app.core.use_cases.ai_command import AICommandDTO, AICommandUseCase

logger = logging.getLogger(__name__)

@dataclass
class AIChatDTO:
    session_id: uuid.UUID
    natural_language_input: str

class AIChatUseCase:
    def __init__(self, llm_port: AbstractLLMPort, ai_command_use_case: AICommandUseCase):
        self.llm_port = llm_port
        self.ai_command_use_case = ai_command_use_case

    async def execute(self, dto: AIChatDTO, ctx: dict) -> tuple[AICommandStatus, str, dict]:
        if not self.llm_port:
            logger.error("LLM Port is not configured. Cannot process AI Chat.")
            return AICommandStatus.FAILED, "AI Service Unavailable", {"detail": "LLM provider is not configured."}

        system_prompt = """Bạn là trợ lý AI (Proteus AI) đóng vai trò là một Orchestrator. Nhiệm vụ của bạn là chuyển đổi câu lệnh ngôn ngữ tự nhiên của người dùng thành một lệnh hệ thống chuẩn DX-DSL.
        
Bạn CHỈ ĐƯỢC PHÉP trả về một object JSON hợp lệ với cấu trúc sau, tuyệt đối không trả lời thêm bất kỳ văn bản nào khác:
{
    "action": "<tên hành động>",
    "effect": "<read | write | critical>",
    "parameters": { "raw_input": "<câu lệnh gốc của người dùng>" },
    "approval_message": "<Nội dung tin nhắn tóm tắt ngắn gọn yêu cầu bằng tiếng Việt để xin duyệt trên Mattermost, chỉ dùng khi effect là write hoặc critical, nếu không thì để null>"
}

Danh sách các hành động (action) được hỗ trợ hiện tại:
1. "hr.leave_requests.batch_approve": (effect: write) Duyệt nghỉ phép, phê duyệt đơn.
2. "core.users.delete": (effect: critical) Xóa người dùng, xoá nhân viên.
3. "hr.employees.search": (effect: read) Tìm kiếm thông tin nhân viên, đọc thông tin.

Nếu câu lệnh không nằm trong các hành động trên, hãy mặc định trả về hành động tìm kiếm với parameters={"raw_input": "<câu lệnh gốc>"}."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": dto.natural_language_input}
        ]

        logger.info(f"Sending natural language to LLM: {dto.natural_language_input}")
        
        try:
            llm_response = await self.llm_port.ainvoke(messages)
            
            # Parse the JSON response
            content = llm_response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            parsed = json.loads(content.strip())
            
            command_dto = AICommandDTO(
                command_id=uuid.uuid4(),
                session_id=dto.session_id,
                dsl_version="1.0",
                action=parsed.get("action", "hr.employees.search"),
                effect=parsed.get("effect", "read"),
                parameters=parsed.get("parameters", {"raw_input": dto.natural_language_input}),
                approval_message=parsed.get("approval_message", None)
            )
            
            # Chuyển tiếp tới AICommandUseCase
            return await self.ai_command_use_case.execute(command_dto, ctx)
            
        except json.JSONDecodeError:
            logger.error(f"Failed to parse LLM output as JSON: {llm_response.content}")
            return AICommandStatus.FAILED, "Lỗi từ AI Service", {"detail": "LLM returned invalid JSON"}
        except Exception as e:
            logger.error(f"Error in AIChatUseCase: {str(e)}")
            return AICommandStatus.FAILED, f"Lỗi hệ thống: {str(e)}", {"detail": str(e)}


# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — AI Orchestrator (DX-DSL)
# Tham chiếu: docs/api-swagger.yaml POST /ai/command, docs/dsl-spec.md

import logging

from fastapi import APIRouter, Depends, status

from app.core.domain.entities import AICommandStatus, TenantContext
from app.core.use_cases.ai_command import AICommandUseCase
from app.core.use_cases.rag_ingestion import RAGIngestionUseCase
from app.entrypoints.dependencies import (
    get_ai_command_use_case,
    get_current_tenant_context,
    get_rag_ingestion_use_case,
)
from app.entrypoints.schemas.ai_command import AICommandRequest, AICommandResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai")


@router.post(
    "/command",
    response_model=AICommandResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Gửi DX-DSL Command đến AI Orchestrator",
)
async def submit_ai_command(
    body: AICommandRequest,
    ctx: TenantContext = Depends(get_current_tenant_context),
    use_case: AICommandUseCase = Depends(get_ai_command_use_case),
) -> AICommandResponse:
    """
    Nhận DX-DSL command từ AI Layer, validate và xử lý.

    - Nếu effect = read: thực thi ngay, trả về kết quả.
    - Nếu effect = write/critical: gửi xin phê duyệt qua Mattermost,
      trả về PENDING_APPROVAL (Human-in-the-loop).

    Tham chiếu: docs/dsl-spec.md §4 (Effect Levels & Approval Rules)
    """
    logger.info(
        "AI command received",
        extra={
            "action": body.action,
            "effect": body.effect,
            "tenant_id": str(ctx.tenant_id),
            "user_id": str(ctx.user_id),
        },
    )

    status_code, message, result = await use_case.execute(body, ctx)

    return AICommandResponse(
        command_id=body.command_id,
        status=status_code,
        message=message,
        execution_result=result if status_code == AICommandStatus.COMPLETED else None,
    )


@router.post(
    "/knowledge/ingest",
    status_code=status.HTTP_200_OK,
    summary="Manual Trigger: RAG Document Ingestion",
)
async def trigger_rag_ingestion(
    ctx: TenantContext = Depends(get_current_tenant_context),
    use_case: RAGIngestionUseCase = Depends(get_rag_ingestion_use_case),
):
    """
    Kích hoạt thủ công quá trình Ingestion tài liệu từ Outline vào Qdrant cho tenant hiện tại.
    """
    result = await use_case.execute(str(ctx.tenant_id))
    return result

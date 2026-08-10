# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — AI Orchestrator (DX-DSL)
# Tham chiếu: docs/api-swagger.yaml POST /ai/command, docs/dsl-spec.md

import logging

from fastapi import APIRouter, Depends, status

from app.adapters.external.outline_adapter import OutlineAdapter
from app.adapters.external.qdrant_adapter import QdrantAdapter
from app.core.domain.entities import AICommandStatus, TenantContext
from app.core.use_cases.rag_ingestion import RAGIngestionUseCase
from app.entrypoints.dependencies import get_current_tenant_context
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
) -> AICommandResponse:
    """
    Nhận DX-DSL command từ AI Layer, validate và xử lý.

    - Nếu effect = read: thực thi ngay, trả về kết quả.
    - Nếu effect = write/critical: gửi xin phê duyệt qua Mattermost,
      trả về PENDING_APPROVAL (Human-in-the-loop).

    Tham chiếu: docs/dsl-spec.md §4 (Effect Levels & Approval Rules)

    TODO: Member sẽ implement DSLValidatorUseCase và AICommandUseCase ở đây.
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

    # TODO: Implement DSL validation và routing logic
    # 1. Gọi DSLValidatorUseCase.validate(body, ctx)
    # 2. Nếu effect=read → execute ngay và trả về result
    # 3. Nếu effect=write/critical → gửi Mattermost approval request
    return AICommandResponse(
        command_id=body.command_id,  # Dùng UUID từ request, không hardcode
        status=AICommandStatus.PENDING_APPROVAL,
        message="Command đã được nhận. Đang chờ phê duyệt từ quản trị viên.",
    )


@router.post(
    "/knowledge/ingest",
    status_code=status.HTTP_200_OK,
    summary="Manual Trigger: RAG Document Ingestion",
)
async def trigger_rag_ingestion(
    ctx: TenantContext = Depends(get_current_tenant_context),
):
    """
    Kích hoạt thủ công quá trình Ingestion tài liệu từ Outline vào Qdrant cho tenant hiện tại.
    """
    # Khởi tạo adapters (thực tế nên dùng DI Container như dependency_injector)
    outline_adapter = OutlineAdapter()
    qdrant_adapter = QdrantAdapter()
    use_case = RAGIngestionUseCase(outline_adapter, qdrant_adapter)

    result = await use_case.execute(str(ctx.tenant_id))
    return result

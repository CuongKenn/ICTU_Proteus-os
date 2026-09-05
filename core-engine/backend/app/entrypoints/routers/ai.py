# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — AI Orchestrator (DX-DSL)
# Tham chiếu: docs/api-swagger.yaml POST /ai/command, docs/dsl-spec.md

import logging

from fastapi import APIRouter, Depends, Request, status

from app.core.domain.entities import AICommandStatus, TenantContext
from app.core.use_cases.ai_command import AICommandDTO, AICommandUseCase
from app.core.use_cases.rag_ingestion import RAGIngestionUseCase
from app.entrypoints.dependencies import (
    get_ai_command_use_case,
    get_current_tenant_context,
    get_rag_ingestion_use_case,
)
from app.entrypoints.schemas.ai_command import AICommandRequest, AICommandResponse
from app.infrastructure.rate_limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai")


@router.post(
    "/command",
    response_model=AICommandResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Gửi DX-DSL Command đến AI Orchestrator",
)
@limiter.limit("10/minute")
async def submit_ai_command(
    request: Request,
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

    dto = AICommandDTO(
        command_id=body.command_id,
        session_id=body.session_id,
        dsl_version=body.dsl_version,
        action=body.action,
        effect=body.effect,
        parameters=body.parameters,
    )
    status_code, message, result = await use_case.execute(dto, ctx)

    return AICommandResponse(
        command_id=body.command_id,
        status=status_code,
        message=message,
        result=result if status_code == AICommandStatus.COMPLETED else None,
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
    Kích hoạt thủ công quá trình Ingestion tài liệu từ Outline vào Qdrant
    cho tenant hiện tại.
    """
    result = await use_case.execute(str(ctx.tenant_id))
    return result


@router.post(
    "/ipc/transmit",
    response_model=None,
    status_code=status.HTTP_200_OK,
    summary="POC: Kích hoạt truyền tải KV-Cache qua Event Bus",
)
async def transmit_kv_cache_ipc(
    body: dict,  # tạm dùng dict thay vì schema nếu chưa import
    request: Request,
    ctx: TenantContext = Depends(get_current_tenant_context),
):
    """
    Kích hoạt giao tiếp IPC giữa 2 AI Agents, sử dụng State Pointer (UUID)
    thay vì gửi toàn bộ Context Text qua Event Bus.
    """
    from app.adapters.external.qdrant_adapter import QdrantAdapter
    from app.adapters.external.redis_event_bus import RedisEventBusPublisher
    from app.ai.kv_cache_ipc import KVCacheIPCManager
    from app.entrypoints.schemas.ai_ipc import (
        KVCacheTransmitRequest,
        KVCacheTransmitResponse,
    )

    req = KVCacheTransmitRequest(**body)

    redis_publisher = getattr(request.app.state, "redis_event_bus", None)
    if redis_publisher is None:
        redis_publisher = RedisEventBusPublisher()

    manager = KVCacheIPCManager(
        qdrant_adapter=QdrantAdapter(
            qdrant_client=getattr(request.app.state, "qdrant_client", None)
        ),
        redis_publisher=redis_publisher,
    )

    pointer_uuid, latency_ms = await manager.transmit_context(
        tenant_id=str(ctx.tenant_id),
        source_agent=req.source_agent,
        target_agent=req.target_agent,
        context_text=req.context_data,
    )

    return KVCacheTransmitResponse(
        pointer_uuid=pointer_uuid,
        latency_ms=latency_ms,
        message="Đã truyền tải Context Pointer thành công",
    )

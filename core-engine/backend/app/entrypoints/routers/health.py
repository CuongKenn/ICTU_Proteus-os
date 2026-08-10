# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — Health Check
# Tham chiếu: docs/api-swagger.yaml GET /health

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.infrastructure.database import engine

logger = logging.getLogger(__name__)
router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str


@router.get(
    "/health", response_model=HealthResponse, summary="Kiểm tra trạng thái hệ thống"
)
async def health_check() -> HealthResponse:
    """
    Endpoint kiểm tra trạng thái cơ bản (không cần auth).
    Traefik / Docker healthcheck gọi endpoint này định kỳ.

    NOTE: Dùng engine.connect() trực tiếp thay vì Depends(get_db)
    để không chiếm connection từ pool khi healthcheck polling liên tục.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        logger.warning("Database health check failed")
        db_status = "error"

    return HealthResponse(status="ok", version="0.1.0", database=db_status)

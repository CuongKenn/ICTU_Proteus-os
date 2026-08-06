# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — Health Check
# Tham chiếu: docs/api-swagger.yaml GET /health

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database import get_db

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str


@router.get("/health", response_model=HealthResponse, summary="Kiểm tra trạng thái hệ thống")
async def health_check(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    """
    Endpoint kiểm tra trạng thái cơ bản (không cần auth).
    Traefik / Docker healthcheck gọi endpoint này.
    """
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return HealthResponse(status="ok", version="0.1.0", database=db_status)

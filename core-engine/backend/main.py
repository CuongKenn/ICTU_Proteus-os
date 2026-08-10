# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS — FastAPI Application Entry Point
# Kiến trúc: Hexagonal Architecture (Ports and Adapters)
# Tham chiếu: docs/architecture.md, docs/api-swagger.yaml

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.entrypoints.routers import ai, health, plugins
from app.infrastructure.config import settings
from app.infrastructure.database import current_tenant_id
from app.infrastructure.logging_config import setup_logging

# ─── Setup logging TRƯỚC KHI làm bất cứ gì ───────────────────
setup_logging(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


# ─── Lifespan (thay thế deprecated @app.on_event) ─────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.entrypoints.dependencies import close_adapters

    logger.info(
        "Proteus OS Backend starting",
        extra={"environment": settings.ENVIRONMENT, "version": "0.1.0"},
    )
    yield
    logger.info("Proteus OS Backend shutting down. Closing adapters...")
    await close_adapters()


# ─── FastAPI Application ──────────────────────────────────────
app = FastAPI(
    title="Proteus OS — Core Engine API",
    description=(
        "API trung tâm của nền tảng Proteus OS. "
        "Tham chiếu đầy đủ: docs/api-swagger.yaml"
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

# ─── CORS ─────────────────────────────────────────────────────
# Chỉ cho phép Next.js BFF gọi vào, không cho phép browser gọi trực tiếp
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-ID"],
)


# ─── Tenant Context Middleware ────────────────────────────────
class TenantIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant_id = request.headers.get("X-Tenant-ID")
        # Lưu vào ContextVar để SQLAlchemy Event có thể đọc được
        token = current_tenant_id.set(tenant_id)
        try:
            response = await call_next(request)
            return response
        finally:
            current_tenant_id.reset(token)


app.add_middleware(TenantIDMiddleware)


# ─── Routers ──────────────────────────────────────────────────
app.include_router(health.router, tags=["System"])
app.include_router(plugins.router, prefix="/api/v1", tags=["Plugins"])
app.include_router(ai.router, prefix="/api/v1", tags=["AI Orchestrator"])

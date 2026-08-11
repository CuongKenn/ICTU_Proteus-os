# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS — FastAPI Application Entry Point
# Kiến trúc: Hexagonal Architecture (Ports and Adapters)
# Tham chiếu: docs/architecture.md, docs/api-swagger.yaml

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.adapters.external.redis_event_bus import RedisEventBusPublisher
from app.core.domain import exceptions as domain_exc
from app.entrypoints.routers import (
    ai,
    auth,
    health,
    keycloak_webhook,
    mattermost_webhook,
    plugins,
)
from app.infrastructure.config import settings
from app.infrastructure.database import current_tenant_id
from app.infrastructure.logging_config import setup_logging

# ─── Setup logging TRƯỚC KHI làm bất cứ gì ───────────────────
setup_logging(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


# ─── Lifespan (thay thế deprecated @app.on_event) ─────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Proteus OS Backend starting",
        extra={"environment": settings.ENVIRONMENT, "version": "0.1.0"},
    )
    # Khởi tạo các global clients
    app.state.http_client = httpx.AsyncClient(timeout=10.0)
    app.state.redis_event_bus = RedisEventBusPublisher()

    yield

    # Đóng kết nối
    await app.state.http_client.aclose()
    await app.state.redis_event_bus.aclose()
    logger.info("Proteus OS Backend shutting down")


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


# ─── Exception Handlers ───────────────────────────────────────
@app.exception_handler(domain_exc.ProteusBaseException)
async def proteus_exception_handler(
    request: Request, exc: domain_exc.ProteusBaseException
):
    logger.warning(
        "Domain exception raised", extra={"error": str(exc), "path": request.url.path}
    )

    status_code = status.HTTP_400_BAD_REQUEST

    if isinstance(
        exc, (domain_exc.TenantNotFoundError, domain_exc.PluginNotFoundError)
    ):
        status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(
        exc,
        (domain_exc.InsufficientPermissionsError, domain_exc.DSLPermissionDeniedError),
    ):
        status_code = status.HTTP_403_FORBIDDEN
    elif isinstance(
        exc, (domain_exc.PluginAlreadyInstalledError, domain_exc.PathConflictError)
    ):
        status_code = status.HTTP_409_CONFLICT

    return JSONResponse(
        status_code=status_code,
        content={"detail": exc.message},
    )


# ─── Routers ──────────────────────────────────────────────────
app.include_router(health.router, tags=["System"])
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(plugins.router, prefix="/api/v1", tags=["Plugins"])
app.include_router(ai.router, prefix="/api/v1", tags=["AI Orchestrator"])
app.include_router(mattermost_webhook.router, prefix="/api/v1")
app.include_router(keycloak_webhook.router, prefix="/api/v1")

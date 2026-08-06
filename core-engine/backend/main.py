# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS — FastAPI Application Entry Point
# Kiến trúc: Hexagonal Architecture (Ports and Adapters)
# Tham chiếu: docs/architecture.md, docs/api-swagger.yaml

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.config import settings
from app.infrastructure.logging_config import setup_logging
from app.entrypoints.routers import health, plugins, ai

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
    yield
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

# ─── Routers ──────────────────────────────────────────────────
app.include_router(health.router, tags=["System"])
app.include_router(plugins.router, prefix="/api/v1", tags=["Plugins"])
app.include_router(ai.router, prefix="/api/v1", tags=["AI Orchestrator"])

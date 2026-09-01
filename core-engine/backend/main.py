# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Proteus OS — FastAPI Application Entry Point
# Kiến trúc: Hexagonal Architecture (Ports and Adapters)
# Tham chiếu: docs/architecture.md, docs/api-swagger.yaml

import logging
from contextlib import asynccontextmanager

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from qdrant_client import AsyncQdrantClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.adapters.external.appsmith_adapter import AppsmithAdapter
from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.external.local_manifest_parser import LocalManifestParser
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.external.metabase_adapter import MetabaseAdapter
from app.adapters.external.n8n_adapter import N8nAdapter
from app.adapters.external.redis_event_bus import RedisEventBusPublisher
from app.adapters.repositories.ai_command_repo import SQLAlchemyAICommandRepository
from app.adapters.repositories.audit_log_repo import SQLAlchemyAuditLogRepository
from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
from app.core.domain import exceptions as domain_exc
from app.core.use_cases.ai_timeout_worker import AITimeoutWorker
from app.core.use_cases.plugin_cleanup_agent import PluginCleanupAgent
from app.entrypoints.routers import (
    ai,
    auth,
    embed,
    health,
    keycloak_webhook,
    mattermost_webhook,
    plugins,
    tenants,
)
from app.infrastructure.config import settings
from app.infrastructure.database import AsyncSessionLocal, current_tenant_id
from app.infrastructure.logging_config import setup_logging
from app.infrastructure.rate_limiter import limiter

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
    app.state.qdrant_client = AsyncQdrantClient(url=settings.QDRANT_URL)
    app.state.redis_event_bus = RedisEventBusPublisher()

    # Khởi tạo scheduler
    scheduler = AsyncIOScheduler()
    app.state.scheduler = scheduler

    async def run_plugin_cleanup() -> None:
        """Plugin cleanup job với error handling và alerting."""
        try:
            async with AsyncSessionLocal() as session:
                plugin_repo = SQLAlchemyPluginRepository(session=session)
                agent = PluginCleanupAgent(
                    plugin_repo=plugin_repo,
                    manifest_parser=LocalManifestParser(),
                    n8n_adapter=N8nAdapter(),
                    metabase_adapter=MetabaseAdapter(),
                    appsmith_adapter=AppsmithAdapter(),
                    keycloak_adapter=KeycloakAdapter(),
                    mattermost_adapter=MattermostAdapter(client=app.state.http_client),
                    session=session,
                )
                await agent.run()
                logger.info("Plugin cleanup job completed successfully.")
        except Exception as e:
            logger.error(
                "Plugin cleanup job FAILED",
                extra={"error": str(e)},
                exc_info=True,
            )
            try:
                mm = MattermostAdapter(client=app.state.http_client)
                await mm.send_message(
                    "system-alerts", f"🚨 Plugin Cleanup Job thất bại: `{e}`"
                )
            except Exception:
                pass

    async def run_ai_timeout_worker() -> None:
        """AI timeout worker với error handling."""
        try:
            async with AsyncSessionLocal() as session:
                ai_command_repo = SQLAlchemyAICommandRepository(session=session)
                audit_log_repo = SQLAlchemyAuditLogRepository(session=session)
                mattermost_adapter = MattermostAdapter(client=app.state.http_client)
                worker = AITimeoutWorker(
                    ai_command_repo=ai_command_repo,
                    audit_log_repo=audit_log_repo,
                    mattermost_adapter=mattermost_adapter,
                )
                await worker.execute()
                logger.info("AI timeout worker completed successfully.")
        except Exception as e:
            logger.error(
                "AI timeout worker FAILED",
                extra={"error": str(e)},
                exc_info=True,
            )
            try:
                mm = MattermostAdapter(client=app.state.http_client)
                await mm.send_message(
                    "system-alerts", f"🚨 AI timeout worker thất bại: `{e}`"
                )
            except Exception:
                pass

    # Chạy cleanup mỗi 10 phút
    scheduler.add_job(run_plugin_cleanup, "interval", minutes=10, id="plugin_cleanup")
    # Chạy timeout worker mỗi 5 phút
    scheduler.add_job(
        run_ai_timeout_worker, "interval", minutes=5, id="ai_timeout_worker"
    )
    scheduler.start()
    logger.info("Đã khởi động APScheduler, Plugin Cleanup Agent và AI Timeout Worker.")

    # Load Python extensions for plugins
    from app.core.dynamic_loader import DynamicPluginLoader

    loader = DynamicPluginLoader(app)
    app.state.plugin_loader = loader
    loader.load_all_plugins()

    yield

    # Đóng kết nối
    scheduler.shutdown()
    await app.state.http_client.aclose()
    await app.state.qdrant_client.close()
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

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(tenants.router, prefix="/api/v1", tags=["Tenants"])
app.include_router(mattermost_webhook.router, prefix="/api/v1")
app.include_router(keycloak_webhook.router, prefix="/api/v1")
app.include_router(embed.router, prefix="/api/v1", tags=["Embed"])

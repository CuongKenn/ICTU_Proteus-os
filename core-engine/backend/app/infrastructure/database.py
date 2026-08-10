# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Infrastructure Layer — SQLAlchemy Async Database Setup

import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, SessionTransaction
from sqlalchemy import event, text
from sqlalchemy.engine import Connection
import contextvars

from app.infrastructure.config import settings

logger = logging.getLogger(__name__)

# ─── ContextVars ──────────────────────────────────────────────
# Lưu trữ tenant_id trong scope của một async task (tương ứng với 1 request)
current_tenant_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_tenant_id", default=None)

# ─── Engine ───────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",  # Log SQL chỉ ở dev
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Kiểm tra connection còn sống trước khi dùng
)

# ─── Session Factory ──────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ─── Row-Level Security (RLS) Event Listener ──────────────────
@event.listens_for(Session, "after_begin")
def receive_after_begin(session: Session, transaction: SessionTransaction, connection: Connection):
    """
    Kích hoạt SET LOCAL app.current_tenant_id trước mỗi transaction.
    Event này chạy đồng bộ (sync) nhưng hoàn toàn an toàn trong môi trường async 
    vì nó được bọc bởi greenlet của SQLAlchemy.
    """
    tenant_id = current_tenant_id.get()
    if tenant_id:
        logger.debug(f"RLS Enabled: Setting app.current_tenant_id = '{tenant_id}'")
        connection.execute(text(f"SET LOCAL app.current_tenant_id = '{tenant_id}'"))
    else:
        # Quan trọng: Nếu không có tenant_id (VD: background job), có thể set rỗng
        # để tránh rò rỉ tenant từ session cũ nếu connection được tái sử dụng từ pool.
        connection.execute(text("SET LOCAL app.current_tenant_id = ''"))



# ─── Base Model ───────────────────────────────────────────────
class Base(DeclarativeBase):
    """Base class cho tất cả SQLAlchemy ORM Models."""

    pass


# ─── Dependency ───────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI Depends()-compatible async generator.
    Tự động commit khi thành công, rollback khi có exception.
    Dùng trực tiếp AsyncSessionLocal — không wrap thêm context manager.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Database session error — rolling back")
            raise

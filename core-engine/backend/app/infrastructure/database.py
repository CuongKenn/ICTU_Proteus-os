# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Infrastructure Layer — SQLAlchemy Async Database Setup

import logging
from collections.abc import AsyncGenerator

from app.infrastructure.config import settings
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)

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

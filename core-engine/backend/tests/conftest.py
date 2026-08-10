# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import asyncio
import os

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

from app.infrastructure.database import Base



@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def postgres_container():
    """Starts a Postgres testcontainer for the entire session."""
    with PostgresContainer("postgres:16-alpine", driver="asyncpg") as postgres:
        yield postgres


@pytest.fixture(scope="function")
async def async_db_engine(postgres_container):
    """Creates a fresh database schema for each test."""
    url = postgres_container.get_connection_url()

    # Workaround: testcontainers returns postgresql+asyncpg:// but SQLAlchemy needs it too
    # sometimes testcontainers returns just postgresql://, we enforce asyncpg
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://")

    engine = create_async_engine(url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(async_db_engine):
    """Provides an async session."""
    SessionLocal = async_sessionmaker(
        autocommit=False, autoflush=False, bind=async_db_engine
    )
    async with SessionLocal() as session:
        yield session

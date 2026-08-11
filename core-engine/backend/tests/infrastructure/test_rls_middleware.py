# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import contextvars

import pytest
from sqlalchemy import text

from app.infrastructure.database import AsyncSessionLocal, current_tenant_id


@pytest.mark.asyncio
async def test_rls_middleware_sets_tenant_id():
    """
    Test kiểm tra xem RLS event listener có tự động SET LOCAL app.current_tenant_id hay không.
    """
    # 1. Set context_var
    valid_uuid = "12345678-1234-5678-1234-567812345678"
    token = current_tenant_id.set(valid_uuid)

    try:
        async with AsyncSessionLocal() as session:
            # Execute một query đơn giản để trigger `after_begin`
            # Và sau đó SELECT current_setting('app.current_tenant_id')
            result = await session.execute(
                text("SELECT current_setting('app.current_tenant_id', true)")
            )
            tenant_id = result.scalar()

            assert (
                tenant_id == valid_uuid
            ), f"Expected '{valid_uuid}', got '{tenant_id}'"
    finally:
        current_tenant_id.reset(token)


@pytest.mark.asyncio
async def test_rls_middleware_empty_tenant_id():
    """
    Trường hợp không có tenant_id (như background jobs), session sẽ được set empty string.
    """
    token = current_tenant_id.set(None)

    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("SELECT current_setting('app.current_tenant_id', true)")
            )
            tenant_id = result.scalar()

            assert tenant_id == "", f"Expected empty string, got '{tenant_id}'"
    finally:
        current_tenant_id.reset(token)

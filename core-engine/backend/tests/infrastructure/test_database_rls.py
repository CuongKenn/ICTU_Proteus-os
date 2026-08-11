# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
import pytest
from sqlalchemy import text
from app.infrastructure.database import current_tenant_id

@pytest.mark.asyncio
async def test_rls_context_is_set(db_session):
    """Verify RLS SET LOCAL được gọi đúng cách cho AsyncSession."""
    tenant_id = str(uuid.uuid4())
    current_tenant_id.set(tenant_id)

    # Trong SQLAlchemy, async session cũng trigger event after_begin của session sync
    # Tuy nhiên, ta cần execute một query để đảm bảo connection được checkout
    result = await db_session.execute(
        text("SELECT current_setting('app.current_tenant_id', true)")
    )
    value = result.scalar()
    
    assert value == tenant_id, f"RLS context không được set: got {value!r}"

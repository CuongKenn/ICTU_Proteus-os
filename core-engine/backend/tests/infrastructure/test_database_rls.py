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


@pytest.mark.asyncio
async def test_plugin_table_rls_isolation(db_session):
    """Kiểm tra RLS filter trên table plugin: query từ sai tenant sẽ trả về rỗng."""
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())
    table_name = "test_plugin_data"

    # Setup database with tenant_admin privileges (to bypass RLS for setup)
    await db_session.execute(text("RESET ROLE"))

    # 1. Create table and RLS policy
    await db_session.execute(
        text(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id serial PRIMARY KEY,
            tenant_id uuid NOT NULL,
            data text
        )
    """)
    )
    await db_session.execute(
        text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
    )
    await db_session.execute(text(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY"))
    await db_session.execute(
        text(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table_name}")
    )
    await db_session.execute(
        text(f"""
        CREATE POLICY tenant_isolation_policy ON {table_name}
        FOR ALL TO public
        USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    """)
    )

    # 2. Insert data for tenant A
    await db_session.execute(
        text(f"INSERT INTO {table_name} (tenant_id, data) VALUES (:t, 'secret A')"),
        {"t": tenant_a},
    )

    # 3. Query as tenant A (must use a non-superuser role to test RLS)
    await db_session.execute(
        text(
            "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'test_app_user') THEN CREATE ROLE test_app_user; END IF; END $$"
        )
    )
    await db_session.execute(text("GRANT USAGE ON SCHEMA public TO test_app_user"))
    await db_session.execute(text(f"GRANT ALL ON TABLE {table_name} TO test_app_user"))
    await db_session.execute(text("SET LOCAL ROLE test_app_user"))

    current_tenant_id.set(tenant_a)
    await db_session.execute(
        text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": tenant_a}
    )
    result_a = await db_session.execute(text(f"SELECT data FROM {table_name}"))
    rows_a = result_a.fetchall()
    assert len(rows_a) == 1
    assert rows_a[0][0] == "secret A"

    # 4. Query as tenant B
    current_tenant_id.set(tenant_b)
    await db_session.execute(
        text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": tenant_b}
    )
    result_b = await db_session.execute(text(f"SELECT data FROM {table_name}"))
    rows_b = result_b.fetchall()
    assert len(rows_b) == 0, "Dữ liệu của Tenant A bị lộ sang Tenant B!"

    # Cleanup
    await db_session.execute(text("RESET ROLE"))
    await db_session.execute(text(f"DROP TABLE {table_name} CASCADE"))

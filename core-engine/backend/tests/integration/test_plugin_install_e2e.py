# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.infrastructure.database import get_db_readonly, get_db_transactional
from main import app


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="Pending Task 11 - Plugin Manager Use Case not yet implemented"
)
async def test_plugin_install_e2e(async_db_engine, db_session):
    """
    Integration test end-to-end với PostgreSQL thực (testcontainers).
    - Full install flow: Tenant → Plugin → status=ACTIVE → bảng hr_employees được tạo
    - Uninstall: status=DELETED → bảng bị DROP
    """
    app.dependency_overrides[get_db_readonly] = lambda: db_session
    app.dependency_overrides[get_db_transactional] = lambda: db_session

    async with AsyncClient(app=app, base_url="http://test") as ac:
        # 1. Tạo Tenant mới
        tenant_id = "00000000-0000-0000-0000-000000000001"
        async with async_db_engine.begin() as conn:
            await conn.execute(
                text(
                    f"INSERT INTO tenants (id, name, domain, keycloak_realm, plan, is_active) VALUES ('{tenant_id}', 'E2E Tenant', 'e2e.proteus.local', 'e2e-realm-1', 'free', true) ON CONFLICT DO NOTHING"
                )
            )

        # Chuẩn bị mock n8n webhook registration
        with patch(
            "app.adapters.external.n8n_adapter.N8nAdapter.import_workflow",
            new_callable=AsyncMock,
        ) as mock_import:
            mock_import.return_value = {
                "id": "1",
                "name": "Test Workflow",
                "active": True,
            }

            plugin_id = "00000000-0000-0000-0000-000000000010"
            # 2. Cài đặt hr-module
            headers = {"X-Tenant-ID": tenant_id}
            res_install = await ac.post(
                "/api/plugins/install", json={"plugin_id": plugin_id}, headers=headers
            )
            assert res_install.status_code == 202
            data = res_install.json()
            assert data["status"] == "ACTIVE"

            # 3. Kiểm tra bảng hr_employees được tạo và có tenant_id không
            async with async_db_engine.connect() as conn:
                result = await conn.execute(
                    text(
                        "SELECT column_name FROM information_schema.columns WHERE table_name = 'hr_employees'"
                    )
                )
                columns = [row[0] for row in result.fetchall()]
                assert "id" in columns
                assert "employee_code" in columns
                assert "tenant_id" in columns  # Plugin Manager tự inject

            # 4. Gỡ cài đặt
            res_uninstall = await ac.post(
                "/api/plugins/uninstall", json={"plugin_id": plugin_id}, headers=headers
            )
            assert res_uninstall.status_code == 200
            data_un = res_uninstall.json()
            assert data_un["status"] == "DELETED"

            # 5. Kiểm tra bảng hr_employees đã bị DROP
            async with async_db_engine.connect() as conn:
                result = await conn.execute(
                    text(
                        "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'hr_employees')"
                    )
                )
                exists = result.scalar()
                assert exists is False

    app.dependency_overrides.clear()


@pytest.mark.asyncio
@pytest.mark.skip(
    reason="Pending Task 11 - Plugin Manager Use Case not yet implemented"
)
async def test_plugin_install_fail_dirty(async_db_engine, db_session):
    """
    Fail: mock n8n 500 → status=FAILED_DIRTY
    """
    app.dependency_overrides[get_db_readonly] = lambda: db_session
    app.dependency_overrides[get_db_transactional] = lambda: db_session

    async with AsyncClient(app=app, base_url="http://test") as ac:
        tenant_id = "00000000-0000-0000-0000-000000000002"
        async with async_db_engine.begin() as conn:
            await conn.execute(
                text(
                    f"INSERT INTO tenants (id, name, domain, keycloak_realm, plan, is_active) VALUES ('{tenant_id}', 'E2E Tenant 2', 'e2e2.proteus.local', 'e2e-realm-2', 'free', true) ON CONFLICT DO NOTHING"
                )
            )
        # Mock lỗi khi import workflow (gây ra lỗi trong workflow phase)
        with patch(
            "app.adapters.external.n8n_adapter.N8nAdapter.import_workflow",
            new_callable=AsyncMock,
        ) as mock_import:
            mock_import.side_effect = Exception("n8n 500 Internal Server Error")

            plugin_id = "00000000-0000-0000-0000-000000000010"
            headers = {"X-Tenant-ID": tenant_id}
            res_install = await ac.post(
                "/api/plugins/install", json={"plugin_id": plugin_id}, headers=headers
            )

            # API Install sẽ trả về 500 hoặc 400 và throw lỗi
            assert res_install.status_code >= 400

            # Kiểm tra trạng thái plugin
            res_get = await ac.get(f"/api/plugins/{plugin_id}", headers=headers)
            if res_get.status_code == 200:
                assert res_get.json()["status"] == "FAILED_DIRTY"

    app.dependency_overrides.clear()

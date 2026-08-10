from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.infrastructure.database import get_db_readonly, get_db_transactional
from app.main import app


@pytest.mark.asyncio
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
        tenant_payload = {
            "id": "tenant-e2e-1",
            "name": "E2E Tenant",
            "domain": "e2e.proteus.local",
        }
        res_tenant = await ac.post("/api/tenants", json=tenant_payload)
        assert res_tenant.status_code in [200, 201]

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

            # 2. Cài đặt hr-module
            headers = {"X-Tenant-ID": "tenant-e2e-1"}
            res_install = await ac.post(
                "/api/plugins/hr-module/install", headers=headers
            )
            assert res_install.status_code == 200
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

            # 4. Uninstall Plugin
            res_uninstall = await ac.post(
                "/api/plugins/hr-module/uninstall", headers=headers
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
async def test_plugin_install_fail_dirty(async_db_engine, db_session):
    """
    Fail: mock n8n 500 → status=FAILED_DIRTY
    """
    app.dependency_overrides[get_db] = lambda: db_session

    async with AsyncClient(app=app, base_url="http://test") as ac:
        tenant_payload = {
            "id": "tenant-e2e-2",
            "name": "E2E Tenant 2",
            "domain": "e2e2.proteus.local",
        }
        await ac.post("/api/tenants", json=tenant_payload)

        # Mock lỗi khi import workflow (gây ra lỗi trong workflow phase)
        with patch(
            "app.adapters.external.n8n_adapter.N8nAdapter.import_workflow",
            new_callable=AsyncMock,
        ) as mock_import:
            mock_import.side_effect = Exception("n8n 500 Internal Server Error")

            headers = {"X-Tenant-ID": "tenant-e2e-2"}
            res_install = await ac.post(
                "/api/plugins/hr-module/install", headers=headers
            )

            # API Install sẽ trả về 500 hoặc 400 và throw lỗi
            assert res_install.status_code >= 400

            # Kiểm tra trạng thái plugin
            res_get = await ac.get("/api/plugins/hr-module", headers=headers)
            if res_get.status_code == 200:
                assert res_get.json()["status"] == "FAILED_DIRTY"

    app.dependency_overrides.clear()

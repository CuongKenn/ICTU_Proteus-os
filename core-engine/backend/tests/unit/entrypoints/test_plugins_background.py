# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.domain.entities import TenantContext
from app.entrypoints.routers.plugins import _run_install_plugin_background


@pytest.mark.asyncio
async def test_run_install_plugin_background_passes_tenant_repo():
    ctx = TenantContext(
        tenant_id="11111111-1111-1111-1111-111111111111",
        user_id="22222222-2222-2222-2222-222222222222",
        roles=["admin"],
        permissions=["plugins.install"],
    )
    app_state = MagicMock()
    app_state.http_client = MagicMock()

    with (
        patch("app.infrastructure.database.AsyncSessionLocal") as mock_session_cls,
        patch(
            "app.entrypoints.routers.plugins.PluginInstallUseCase"
        ) as mock_use_case_cls,
        patch(
            "app.adapters.repositories.tenant_repo.SQLAlchemyTenantRepository"
        ) as mock_tenant_repo_cls,
        patch("app.adapters.repositories.plugin_repo.SQLAlchemyPluginRepository"),
    ):
        mock_session = AsyncMock()
        mock_session_cls.return_value.__aenter__.return_value = mock_session

        mock_use_case_instance = MagicMock()
        mock_use_case_instance.execute = AsyncMock()
        mock_use_case_cls.return_value = mock_use_case_instance

        mock_tenant_repo_instance = MagicMock()
        mock_tenant_repo_cls.return_value = mock_tenant_repo_instance

        await _run_install_plugin_background(ctx, "hr_module", [], app_state)

        mock_use_case_cls.assert_called_once()
        _, kwargs = mock_use_case_cls.call_args
        assert "tenant_repo" in kwargs
        assert kwargs["tenant_repo"] == mock_tenant_repo_instance
        mock_use_case_instance.execute.assert_called_once_with(
            context=ctx, plugin_code_name="hr_module", credentials=[]
        )

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Configure Plugin Credentials Use Case

import logging

from app.core.domain.entities import TenantContext
from app.core.domain.ports import AbstractWorkflowEnginePort
from app.entrypoints.schemas.plugin import PluginCredentialPayload

logger = logging.getLogger(__name__)


class ConfigurePluginCredentialsUseCase:
    """
    Quản lý luồng cấu hình Credentials cho Plugin.
    Chỉ thực hiện việc chuyển tiếp credentials an toàn tới n8n (hoặc các adapter tương ứng)
    mà không lưu trữ trong database của Proteus OS.
    """

    def __init__(self, n8n_adapter: AbstractWorkflowEnginePort):
        self.n8n_adapter = n8n_adapter

    async def execute(
        self, plugin_id: str, payload: PluginCredentialPayload, ctx: TenantContext
    ) -> dict:
        """Thực thi cấu hình credentials."""
        logger.info(
            "Configuring credentials for plugin %s in tenant %s",
            plugin_id,
            ctx.tenant_id,
        )

        # RLS Prefix: tenant_{tenant_id}_name
        safe_name = f"tenant_{ctx.tenant_id}_{payload.credential_name}"

        result = await self.n8n_adapter.create_credential(
            credential_type=payload.credential_type,
            credential_name=safe_name,
            data=payload.data,
        )

        return {
            "message": "Credential tạo thành công",
            "credential_id": result.get("id"),
            "safe_name": safe_name,
        }

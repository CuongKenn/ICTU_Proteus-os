# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — Plugin Management
# Tham chiếu: docs/api-swagger.yaml /plugins/*

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import TenantContext
from app.core.use_cases.plugin_install import PluginInstallError, PluginInstallUseCase
from app.core.use_cases.plugin_list import PluginListUseCase
from app.core.use_cases.plugin_uninstall import (
    PluginUninstallError,
    PluginUninstallUseCase,
)
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_plugin_install_use_case,
    get_plugin_list_use_case,
    get_plugin_repo,
    get_plugin_uninstall_use_case,
)
from app.entrypoints.schemas.plugin import (
    PluginInstallRequest,
    PluginListResponse,
    PluginResponse,
    PluginUninstallRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/plugins")


@router.get("", response_model=PluginListResponse, summary="Liệt kê Plugin Marketplace")
async def list_marketplace_plugins(
    limit: int = 20,
    offset: int = 0,
    ctx: TenantContext = Depends(get_current_tenant_context),
    use_case: PluginListUseCase = Depends(get_plugin_list_use_case),
) -> PluginListResponse:
    """Lấy danh sách Plugin trên Marketplace (chưa cài hoặc đã cài)."""
    plugins, total = await use_case.list_marketplace(limit=limit, offset=offset)
    return PluginListResponse(
        items=[PluginResponse.model_validate(p.model_dump()) for p in plugins],
        total=total,
    )


@router.get(
    "/installed", response_model=PluginListResponse, summary="Liệt kê Plugin đã cài"
)
async def list_installed_plugins(
    ctx: TenantContext = Depends(get_current_tenant_context),
    use_case: PluginListUseCase = Depends(get_plugin_list_use_case),
) -> PluginListResponse:
    """Lấy danh sách Plugin đang ACTIVE của Tenant hiện tại."""
    plugins, total = await use_case.list_installed(tenant_id=ctx.tenant_id)
    return PluginListResponse(
        items=[PluginResponse.model_validate(p.model_dump()) for p in plugins],
        total=total,
    )


@router.post(
    "/install",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Cài đặt Plugin",
)
async def install_plugin(
    body: PluginInstallRequest,
    ctx: TenantContext = Depends(get_current_tenant_context),
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
) -> dict[str, Any]:
    """
    Khởi động quá trình cài đặt Plugin.
    Chỉ tenant_admin hoặc superadmin mới có quyền thực hiện.
    Trả về HTTP 202 Accepted — việc cài đặt chạy ngầm.

    TODO: Member sẽ implement PluginManagerUseCase ở đây.
    """
    # Kiểm tra quyền
    if not any(r in ctx.roles for r in ["tenant_admin", "superadmin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tenant_admin hoặc superadmin mới có thể cài đặt Plugin.",
        )

    logger.info(
        "Plugin install requested",
        extra={
            "plugin_id": str(body.plugin_id),
            "tenant_id": str(ctx.tenant_id),
            "user_id": str(ctx.user_id),
        },
    )

    # TODO: Gọi PluginManagerUseCase.install() thay vì placeholder này
    return {
        "message": "Plugin installation queued.",
        "plugin_id": str(body.plugin_id),
        "status": "INSTALLING",
    }


@router.delete(
    "/{plugin_id}",
    status_code=status.HTTP_200_OK,
    summary="Gỡ cài đặt Plugin",
)
async def uninstall_plugin(
    plugin_id: uuid.UUID,
    body: PluginUninstallRequest,
    ctx: TenantContext = Depends(get_current_tenant_context),
    use_case: PluginUninstallUseCase = Depends(get_plugin_uninstall_use_case),
) -> dict[str, str]:
    """
    Gỡ cài đặt Plugin. Xóa các Workflow, Dashboard, DB Table liên quan.
    Yêu cầu xác nhận tên Plugin bằng `confirm_name`.
    """
    try:
        await use_case.uninstall_plugin(
            context=ctx,
            plugin_id=plugin_id,
            confirm_name=body.confirm_name,
        )
    except PluginUninstallError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {"message": "Gỡ cài đặt Plugin thành công."}

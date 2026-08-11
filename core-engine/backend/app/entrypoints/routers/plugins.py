# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — Plugin Management
# Tham chiếu: docs/api-swagger.yaml /plugins/*

import logging
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import TenantContext
from app.core.use_cases.plugin_install import PluginInstallError, PluginInstallUseCase
from app.core.use_cases.plugin_list import PluginListUseCase
from app.core.use_cases.plugin_toggle import PluginToggleError, PluginToggleUseCase
from app.core.use_cases.plugin_uninstall import (
    PluginUninstallError,
    PluginUninstallUseCase,
)
from app.core.use_cases.plugin_upgrade import PluginUpgradeError, PluginUpgradeUseCase
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_plugin_install_use_case,
    get_plugin_list_use_case,
    get_plugin_repo,
    get_plugin_toggle_use_case,
    get_plugin_uninstall_use_case,
    get_plugin_upgrade_use_case,
)
from app.entrypoints.schemas.plugin import (
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
    "/{plugin_id}/install",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Cài đặt Plugin",
)
async def install_plugin(
    plugin_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    ctx: TenantContext = Depends(get_current_tenant_context),
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
    use_case: PluginInstallUseCase = Depends(get_plugin_install_use_case),
) -> dict[str, Any]:
    """
    Khởi động quá trình cài đặt Plugin.
    Chỉ tenant_admin hoặc superadmin mới có quyền thực hiện.
    Trả về HTTP 202 Accepted — việc cài đặt chạy ngầm.
    """
    if not any(r in ctx.roles for r in ["tenant_admin", "superadmin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tenant_admin hoặc superadmin mới có thể cài đặt Plugin.",
        )

    plugin = await repo.get_by_id(plugin_id)
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin không tồn tại.",
        )

    logger.info(
        "Plugin install requested",
        extra={
            "plugin_id": str(plugin_id),
            "plugin_code": plugin.code_name,
            "tenant_id": str(ctx.tenant_id),
            "user_id": str(ctx.user_id),
        },
    )

    # Chạy cài đặt ngầm bằng BackgroundTasks
    background_tasks.add_task(
        use_case.execute, context=ctx, plugin_code_name=plugin.code_name
    )

    return {
        "message": "Plugin installation queued.",
        "plugin_id": str(plugin_id),
        "status": "INSTALLING",
    }


@router.delete(
    "/{plugin_id}/uninstall",
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
    # Kiểm tra quyền
    if not any(r in ctx.roles for r in ["tenant_admin", "superadmin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tenant_admin hoặc superadmin mới có thể thao tác.",
        )

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


@router.post(
    "/{plugin_id}/disable",
    status_code=status.HTTP_200_OK,
    summary="Vô hiệu hóa Plugin",
)
async def disable_plugin(
    plugin_id: uuid.UUID,
    ctx: TenantContext = Depends(get_current_tenant_context),
    use_case: PluginToggleUseCase = Depends(get_plugin_toggle_use_case),
) -> dict[str, str]:
    if not any(r in ctx.roles for r in ["tenant_admin", "superadmin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tenant_admin hoặc superadmin mới có thể thao tác.",
        )

    try:
        await use_case.disable_plugin(context=ctx, plugin_id=plugin_id)
    except PluginToggleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {"message": "Plugin đã được vô hiệu hóa."}


@router.post(
    "/{plugin_id}/enable",
    status_code=status.HTTP_200_OK,
    summary="Bật lại Plugin",
)
async def enable_plugin(
    plugin_id: uuid.UUID,
    ctx: TenantContext = Depends(get_current_tenant_context),
    use_case: PluginToggleUseCase = Depends(get_plugin_toggle_use_case),
) -> dict[str, str]:
    if not any(r in ctx.roles for r in ["tenant_admin", "superadmin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tenant_admin hoặc superadmin mới có thể thao tác.",
        )

    try:
        await use_case.enable_plugin(context=ctx, plugin_id=plugin_id)
    except PluginToggleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {"message": "Plugin đã được bật lại."}


@router.post(
    "/{plugin_id}/upgrade",
    status_code=status.HTTP_200_OK,
    summary="Nâng cấp Plugin",
)
async def upgrade_plugin(
    plugin_id: uuid.UUID,
    ctx: TenantContext = Depends(get_current_tenant_context),
    use_case: PluginUpgradeUseCase = Depends(get_plugin_upgrade_use_case),
) -> dict[str, str]:
    if not any(r in ctx.roles for r in ["tenant_admin", "superadmin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tenant_admin hoặc superadmin mới có thể thao tác.",
        )

    try:
        await use_case.upgrade_plugin(context=ctx, plugin_id=plugin_id)
    except PluginUpgradeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {"message": "Nâng cấp Plugin thành công."}

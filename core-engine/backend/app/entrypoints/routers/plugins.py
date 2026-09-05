# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — Plugin Management
# Tham chiếu: docs/api-swagger.yaml /plugins/*

import logging
import uuid
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    status,
)

from app.adapters.external.n8n_adapter import N8nAdapter, N8nAdapterError
from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import TenantContext
from app.core.use_cases.plugin_credentials import ConfigurePluginCredentialsUseCase
from app.core.use_cases.plugin_install import PluginInstallUseCase
from app.core.use_cases.plugin_list import PluginListUseCase
from app.core.use_cases.plugin_toggle import PluginToggleError, PluginToggleUseCase
from app.core.use_cases.plugin_uninstall import (
    PluginUninstallError,
    PluginUninstallUseCase,
)
from app.core.use_cases.plugin_upgrade import PluginUpgradeError, PluginUpgradeUseCase
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_plugin_credentials_use_case,
    get_plugin_list_use_case,
    get_plugin_repo,
    get_plugin_toggle_use_case,
    get_plugin_uninstall_use_case,
    get_plugin_upgrade_use_case,
    require_permission,
)
from app.entrypoints.schemas.plugin import (
    PluginCredentialPayload,
    PluginListResponse,
    PluginResponse,
    PluginSynthesizeRequest,
    PluginUninstallRequest,
)
from app.infrastructure.rate_limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/plugins")


@router.get("", response_model=PluginListResponse, summary="Liệt kê Plugin Marketplace")
async def list_marketplace_plugins(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
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


async def _run_install_plugin_background(
    ctx: TenantContext, plugin_code_name: str, app_state
):
    from app.adapters.external.appsmith_adapter import AppsmithAdapter
    from app.adapters.external.keycloak_adapter import KeycloakAdapter
    from app.adapters.external.local_manifest_parser import LocalManifestParser
    from app.adapters.external.mattermost_adapter import MattermostAdapter
    from app.adapters.external.metabase_adapter import MetabaseAdapter
    from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
    from app.infrastructure.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            repo = SQLAlchemyPluginRepository(session=session)
            use_case = PluginInstallUseCase(
                plugin_repo=repo,
                manifest_parser=LocalManifestParser(),
                n8n_adapter=N8nAdapter(client=app_state.http_client),
                metabase_adapter=MetabaseAdapter(client=app_state.http_client),
                appsmith_adapter=AppsmithAdapter(client=app_state.http_client),
                keycloak_adapter=KeycloakAdapter(client=app_state.http_client),
                mattermost_adapter=MattermostAdapter(client=app_state.http_client),
                session=session,
            )
            await use_case.execute(context=ctx, plugin_code_name=plugin_code_name)
    except Exception as e:
        logger.error(f"Background task plugin install failed: {e}", exc_info=True)



@router.post(
    "/{plugin_id}/install",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Cài đặt Plugin",
)
async def install_plugin(
    request: Request,
    plugin_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    ctx: TenantContext = Depends(require_permission("plugins.install")),
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
) -> dict[str, Any]:
    """
    Khởi động quá trình cài đặt Plugin.
    Chỉ tenant_admin hoặc superadmin mới có quyền thực hiện.
    Trả về HTTP 202 Accepted — việc cài đặt chạy ngầm.
    """
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
        _run_install_plugin_background,
        ctx=ctx,
        plugin_code_name=plugin.code_name,
        app_state=request.app.state,
    )

    return {
        "message": "Plugin installation queued.",
        "plugin_id": str(plugin_id),
        "task_id": str(plugin_id),
        "status": "INSTALLING",
    }


@router.get(
    "/install/{task_id}/status",
    status_code=status.HTTP_200_OK,
    summary="Lấy trạng thái cài đặt Plugin (Mock)",
)
async def get_install_status(
    task_id: str,
    request: Request,
    ctx: TenantContext = Depends(get_current_tenant_context),
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
) -> dict[str, Any]:

    try:
        plugin_uuid = uuid.UUID(task_id)
    except ValueError as e:
        raise HTTPException(
            status_code=400, detail="Invalid task_id (must be UUID of plugin)"
        ) from e

    status_val = await repo.get_installation_status(ctx.tenant_id, plugin_uuid)

    if status_val is None:
        raise HTTPException(
            status_code=404, detail="Plugin installation not found for this tenant"
        )

    return {
        "overall_status": status_val.value,
        "steps": [],
    }


@router.delete(
    "/{plugin_id}/uninstall",
    status_code=status.HTTP_200_OK,
    summary="Gỡ cài đặt Plugin",
)
async def uninstall_plugin(
    plugin_id: uuid.UUID,
    body: PluginUninstallRequest,
    ctx: TenantContext = Depends(require_permission("plugins.uninstall")),
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
        ) from e

    return {"message": "Gỡ cài đặt Plugin thành công."}


@router.post(
    "/{plugin_id}/disable",
    status_code=status.HTTP_200_OK,
    summary="Vô hiệu hóa Plugin",
)
async def disable_plugin(
    plugin_id: uuid.UUID,
    ctx: TenantContext = Depends(require_permission("plugins.disable")),
    use_case: PluginToggleUseCase = Depends(get_plugin_toggle_use_case),
) -> dict[str, str]:
    try:
        await use_case.disable_plugin(context=ctx, plugin_id=plugin_id)
    except PluginToggleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    return {"message": "Plugin đã được vô hiệu hóa."}


@router.post(
    "/{plugin_id}/enable",
    status_code=status.HTTP_200_OK,
    summary="Bật lại Plugin",
)
async def enable_plugin(
    plugin_id: uuid.UUID,
    ctx: TenantContext = Depends(require_permission("plugins.enable")),
    use_case: PluginToggleUseCase = Depends(get_plugin_toggle_use_case),
) -> dict[str, str]:
    try:
        await use_case.enable_plugin(context=ctx, plugin_id=plugin_id)
    except PluginToggleError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e

    return {"message": "Plugin đã được bật lại."}


@router.post(
    "/{plugin_id}/upgrade",
    status_code=status.HTTP_200_OK,
    summary="Nâng cấp Plugin",
)
async def upgrade_plugin(
    plugin_id: uuid.UUID,
    ctx: TenantContext = Depends(require_permission("plugins.upgrade")),
    use_case: PluginUpgradeUseCase = Depends(get_plugin_upgrade_use_case),
) -> dict[str, str]:
    try:
        await use_case.upgrade_plugin(context=ctx, plugin_id=plugin_id)
    except PluginUpgradeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    return {"message": "Nâng cấp Plugin thành công."}


@router.post(
    "/reload",
    status_code=status.HTTP_200_OK,
    summary="Hot-Reload Plugins",
)
async def reload_plugins(
    request: Request,
    ctx: TenantContext = Depends(require_permission("plugins.install")),
) -> dict[str, str]:
    """
    Quét lại thư mục plugins và nạp động (hot-reload) các Python extensions
    mà không cần khởi động lại server.
    """
    loader = getattr(request.app.state, "plugin_loader", None)
    if loader:
        loader.load_all_plugins()
        return {"message": "Đã hot-reload tất cả plugin extensions."}
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Plugin loader không được cấu hình.",
    )


@router.post(
    "/synthesize",
    status_code=status.HTTP_200_OK,
    summary="Tự động sinh Plugin bằng AI",
)
@limiter.limit("3/hour")
async def synthesize_plugin(
    request: Request,
    body: PluginSynthesizeRequest,
    ctx: TenantContext = Depends(require_permission("plugins.install")),
) -> dict[str, str]:
    """
    Sử dụng LLM (LangChain) để tự động sinh mã nguồn cho một Plugin mới
    dựa trên prompt của người dùng, sau đó tự động load vào hệ thống.
    """
    from app.ai.plugin_synthesizer import PluginSynthesizer

    synthesizer = PluginSynthesizer()
    try:
        plugin_name = await synthesizer.synthesize(body.prompt)

        # Cố gắng load tự động
        loader = getattr(request.app.state, "plugin_loader", None)
        if loader:
            loader.load_plugin(plugin_name)

        return {
            "message": f"Đã sinh và nạp thành công Plugin: {plugin_name}",
            "plugin_code_name": plugin_name,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi sinh Plugin: {e}",
        ) from e


@router.post(
    "/{plugin_id}/credentials",
    status_code=status.HTTP_201_CREATED,
    summary="Cấu hình n8n Credentials",
)
async def configure_plugin_credentials(
    plugin_id: uuid.UUID,
    payload: PluginCredentialPayload,
    ctx: TenantContext = Depends(require_permission("plugins.install")),
    use_case: ConfigurePluginCredentialsUseCase = Depends(
        get_plugin_credentials_use_case
    ),
) -> dict[str, Any]:
    """
    Tạo n8n Credentials cho Plugin trực tiếp từ UI.
    Chỉ tenant_admin mới có quyền. Credential name sẽ được gán prefix tự động
    để đảm bảo cách ly dữ liệu giữa các tenant.
    """
    try:
        result = await use_case.execute(
            plugin_id=str(plugin_id),
            payload=payload,
            ctx=ctx,
        )
        return result
    except N8nAdapterError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error("Lỗi không xác định khi tạo credential: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        ) from e

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — Tenants Router (REST API)

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.domain.entities import TenantContext
from app.core.use_cases.tenant_onboarding import (
    TenantOnboardingError,
    TenantOnboardingUseCase,
    TenantPermissionError,
)
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_tenant_onboarding_use_case,
)
from app.entrypoints.schemas.tenant import (
    TenantCreateRequest,
    TenantResponse,
    TenantUpdateRequest,
    IntegrationCreateRequest,
    IntegrationResponse,
)
from app.adapters.repositories.base import AbstractTenantRepository
from app.core.domain.entities import TenantIntegrationEntity
from app.entrypoints.dependencies import get_tenant_repo

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.post(
    "",
    response_model=TenantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo Tenant mới",
)
async def create_tenant(
    request: TenantCreateRequest,
    context: TenantContext = Depends(get_current_tenant_context),
    use_case: TenantOnboardingUseCase = Depends(get_tenant_onboarding_use_case),
):
    try:
        tenant = await use_case.create_tenant(
            context=context, name=request.name, slug=request.slug, plan=request.plan
        )
        return tenant
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except TenantOnboardingError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.get(
    "/me",
    response_model=TenantResponse,
    summary="Lấy thông tin Tenant hiện tại",
)
async def get_current_tenant(
    context: TenantContext = Depends(get_current_tenant_context),
    repo: AbstractTenantRepository = Depends(get_tenant_repo),
):
    tenant = await repo.get_by_id(context.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch(
    "/me",
    response_model=TenantResponse,
    summary="Cập nhật thông tin Tenant hiện tại",
)
async def update_current_tenant(
    request: TenantUpdateRequest,
    context: TenantContext = Depends(get_current_tenant_context),
    repo: AbstractTenantRepository = Depends(get_tenant_repo),
):
    if "tenant_admin" not in context.roles:
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền cập nhật Tenant")
    
    update_data = request.model_dump(exclude_unset=True)
    if not update_data:
        tenant = await repo.get_by_id(context.tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return tenant
        
    tenant = await repo.update(context.tenant_id, update_data)
    return tenant


@router.get(
    "/integrations",
    response_model=list[IntegrationResponse],
    summary="Danh sách tích hợp",
)
async def get_tenant_integrations(
    context: TenantContext = Depends(get_current_tenant_context),
    repo: AbstractTenantRepository = Depends(get_tenant_repo),
):
    integrations = await repo.get_integrations(context.tenant_id)
    return integrations


@router.post(
    "/integrations",
    response_model=IntegrationResponse,
    summary="Cấu hình tích hợp mới",
)
async def configure_tenant_integration(
    request: IntegrationCreateRequest,
    context: TenantContext = Depends(get_current_tenant_context),
    repo: AbstractTenantRepository = Depends(get_tenant_repo),
):
    if "tenant_admin" not in context.roles:
        raise HTTPException(status_code=403, detail="Chỉ Admin mới có quyền cấu hình Integrations")
        
    entity = TenantIntegrationEntity(
        id=uuid.uuid4(),
        tenant_id=context.tenant_id,
        provider=request.provider,
        config_data=request.config_data,
        is_active=request.is_active,
    )
    integration = await repo.upsert_integration(entity)
    return integration


@router.get(
    "/{tenant_id}",
    response_model=TenantResponse,
    summary="Lấy thông tin Tenant",
)
async def get_tenant(
    tenant_id: uuid.UUID,
    context: TenantContext = Depends(get_current_tenant_context),
    use_case: TenantOnboardingUseCase = Depends(get_tenant_onboarding_use_case),
):
    try:
        tenant = await use_case.get_tenant(context, tenant_id)
        return tenant
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except TenantOnboardingError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.patch(
    "/{tenant_id}",
    response_model=TenantResponse,
    summary="Cập nhật Tenant",
)
async def update_tenant(
    tenant_id: uuid.UUID,
    request: TenantUpdateRequest,
    context: TenantContext = Depends(get_current_tenant_context),
    use_case: TenantOnboardingUseCase = Depends(get_tenant_onboarding_use_case),
):
    try:
        data = request.model_dump(exclude_unset=True)
        tenant = await use_case.update_tenant(context, tenant_id, data)
        return tenant
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except TenantOnboardingError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.delete(
    "/{tenant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa (Soft delete) Tenant",
)
async def delete_tenant(
    tenant_id: uuid.UUID,
    context: TenantContext = Depends(get_current_tenant_context),
    use_case: TenantOnboardingUseCase = Depends(get_tenant_onboarding_use_case),
):
    try:
        await use_case.delete_tenant(context, tenant_id)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except TenantOnboardingError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

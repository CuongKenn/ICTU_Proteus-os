# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — Tenants Router (REST API)

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.domain.entities import TenantContext
from app.core.use_cases.tenant_onboarding import (
    PermissionError,
    TenantOnboardingError,
    TenantOnboardingUseCase,
)
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_tenant_onboarding_use_case,
)
from app.entrypoints.schemas.tenant import (
    TenantCreateRequest,
    TenantResponse,
    TenantUpdateRequest,
)

router = APIRouter(prefix="/api/v1/tenants", tags=["Tenants"])


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

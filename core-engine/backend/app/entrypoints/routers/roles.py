# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.role_repo import RoleRepository
from app.core.domain.entities import TenantContext
from app.core.domain.exceptions import NotFoundError
from app.core.use_cases.role_management import RoleManagementUseCase
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_db_transactional,
)
from app.entrypoints.schemas.role import (
    RoleAssign,
    RoleCreate,
    RoleResponse,
    RoleUpdate,
)

router = APIRouter(prefix="/roles", tags=["Roles"])


def get_role_use_case(
    session: AsyncSession = Depends(get_db_transactional),
) -> RoleManagementUseCase:
    from app.adapters.repositories.user_repo import SQLAlchemyUserRepository
    role_repo = RoleRepository(session)
    user_repo = SQLAlchemyUserRepository(session)
    return RoleManagementUseCase(role_repo, user_repo)


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: RoleManagementUseCase = Depends(get_role_use_case),
):
    """
    Tạo Role mới cho Tenant.
    """
    role = await use_case.create_role(tenant_context.tenant_id, data.model_dump())
    return role


@router.get("", response_model=list[RoleResponse])
async def list_roles(
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: RoleManagementUseCase = Depends(get_role_use_case),
):
    """
    Liệt kê tất cả các roles của Tenant.
    """
    roles = await use_case.list_roles(tenant_context.tenant_id)
    return roles


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: uuid.UUID,
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: RoleManagementUseCase = Depends(get_role_use_case),
):
    """
    Lấy chi tiết một Role theo ID.
    """
    role = await use_case.get_role(role_id, tenant_context.tenant_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: uuid.UUID,
    data: RoleUpdate,
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: RoleManagementUseCase = Depends(get_role_use_case),
):
    """
    Cập nhật thông tin Role hoặc phân quyền (permissions) cho Role.
    """
    try:
        role = await use_case.update_role(
            role_id, tenant_context.tenant_id, data.model_dump(exclude_unset=True)
        )
        return role
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: uuid.UUID,
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: RoleManagementUseCase = Depends(get_role_use_case),
):
    """
    Xóa một Role.
    """
    try:
        await use_case.delete_role(role_id, tenant_context.tenant_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{role_id}/assign")
async def assign_role_to_user(
    role_id: uuid.UUID,
    data: RoleAssign,
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: RoleManagementUseCase = Depends(get_role_use_case),
):
    """
    Gán một Role cho một User.
    """
    try:
        await use_case.assign_role_to_user(
            data.user_id, role_id, tenant_context.user_id, tenant_context.tenant_id
        )
        return {"detail": "Role assigned successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{role_id}/revoke")
async def revoke_role_from_user(
    role_id: uuid.UUID,
    data: RoleAssign,
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: RoleManagementUseCase = Depends(get_role_use_case),
):
    """
    Thu hồi một Role từ một User.
    """
    try:
        await use_case.revoke_role_from_user(
            data.user_id, role_id, tenant_context.tenant_id
        )
        return {"detail": "Role revoked successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

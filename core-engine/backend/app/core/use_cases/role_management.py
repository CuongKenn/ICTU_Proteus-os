# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid

from app.adapters.repositories.role_repo import RoleRepository
from app.infrastructure.models import RoleModel, UserRoleModel


class RoleManagementUseCase:
    """
    Use Case: Quản lý Roles & Permissions.
    """

    def __init__(self, role_repo: RoleRepository, user_repo=None):
        self.role_repo = role_repo
        self.user_repo = user_repo

    async def create_role(self, tenant_id: uuid.UUID, role_data: dict) -> RoleModel:
        role_data["tenant_id"] = tenant_id
        role = await self.role_repo.create_role(role_data)
        return role

    async def get_role(
        self, role_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> RoleModel | None:
        return await self.role_repo.get_role(role_id, tenant_id)

    async def update_role(
        self, role_id: uuid.UUID, tenant_id: uuid.UUID, update_data: dict
    ) -> RoleModel:
        # Prevent updating tenant_id or id
        update_data.pop("id", None)
        update_data.pop("tenant_id", None)
        return await self.role_repo.update_role(role_id, tenant_id, update_data)

    async def delete_role(self, role_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
        await self.role_repo.delete_role(role_id, tenant_id)

    async def list_roles(self, tenant_id: uuid.UUID) -> list[RoleModel]:
        return await self.role_repo.list_by_tenant(tenant_id)

    async def assign_role_to_user(
        self,
        user_id: uuid.UUID,
        role_id: uuid.UUID,
        granted_by: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> UserRoleModel:
        # Validate role exists and belongs to tenant
        role = await self.role_repo.get_role(role_id, tenant_id)
        if not role:
            raise ValueError(f"Role {role_id} not found in tenant {tenant_id}")
            
        admin_internal_id = None
        if self.user_repo and granted_by:
            admin_user = await self.user_repo.get_by_keycloak_id(granted_by)
            if admin_user:
                admin_internal_id = admin_user.id

        return await self.role_repo.assign_role(user_id, role_id, admin_internal_id)

    async def revoke_role_from_user(
        self, user_id: uuid.UUID, role_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> None:
        # Validate role exists and belongs to tenant
        role = await self.role_repo.get_role(role_id, tenant_id)
        if not role:
            raise ValueError(f"Role {role_id} not found in tenant {tenant_id}")

        await self.role_repo.revoke_role(user_id, role_id)

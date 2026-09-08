# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain.exceptions import NotFoundError
from app.infrastructure.models import RoleModel, UserRoleModel


class RoleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_role(self, role_data: dict) -> RoleModel:
        """
        Tạo Role mới (thường dùng khi cài đặt Plugin để register roles).
        """
        role = RoleModel(**role_data)
        self.session.add(role)
        await self.session.flush()
        return role

    async def assign_role(
        self, user_id: uuid.UUID, role_id: uuid.UUID, granted_by: uuid.UUID
    ) -> UserRoleModel:
        """
        Cấp role cho user.
        """
        from sqlalchemy.exc import IntegrityError
        
        user_role = UserRoleModel(
            user_id=user_id, role_id=role_id, granted_by_user_id=granted_by
        )
        self.session.add(user_role)
        try:
            await self.session.flush()
        except IntegrityError:
            raise ValueError(f"User {user_id} already has Role {role_id}")
            
        return user_role

    async def revoke_role(self, user_id: uuid.UUID, role_id: uuid.UUID) -> None:
        """
        Thu hồi role của user.
        """
        stmt = delete(UserRoleModel).where(
            and_(UserRoleModel.user_id == user_id, UserRoleModel.role_id == role_id)
        )
        result = await self.session.execute(stmt)
        if result.rowcount == 0:
            raise NotFoundError(f"User {user_id} does not have Role {role_id}")

    async def list_by_tenant(self, tenant_id: uuid.UUID) -> list[RoleModel]:
        """
        Lấy danh sách các Roles của một Tenant.
        """
        stmt = select(RoleModel).where(RoleModel.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_user_permissions(self, user_id: uuid.UUID) -> list[str]:
        """
        Lấy danh sách các permission strings (ví dụ: ["plugins:read", "users:write"])
        thuộc các roles mà user đang nắm giữ.
        """
        stmt = (
            select(RoleModel.permissions)
            .join(UserRoleModel, UserRoleModel.role_id == RoleModel.id)
            .where(UserRoleModel.user_id == user_id)
        )
        result = await self.session.execute(stmt)

        all_permissions = set()
        for row in result.all():
            permissions_data = row[0]
            if not permissions_data:
                continue
            if isinstance(permissions_data, list):
                all_permissions.update(str(p) for p in permissions_data)
            elif isinstance(permissions_data, dict):
                if "allowed" in permissions_data and isinstance(
                    permissions_data["allowed"], list
                ):
                    all_permissions.update(str(p) for p in permissions_data["allowed"])
                else:
                    all_permissions.update(
                        k for k, v in permissions_data.items() if v is True
                    )

        return list(all_permissions)

    async def get_role(
        self, role_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> RoleModel | None:
        """
        Lấy chi tiết một Role theo ID và Tenant.
        """
        stmt = select(RoleModel).where(
            and_(RoleModel.id == role_id, RoleModel.tenant_id == tenant_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_role(
        self, role_id: uuid.UUID, tenant_id: uuid.UUID, data: dict
    ) -> RoleModel:
        """
        Cập nhật Role.
        """
        role = await self.get_role(role_id, tenant_id)
        if not role:
            raise NotFoundError(f"Role {role_id} not found in tenant {tenant_id}")

        for key, value in data.items():
            if hasattr(role, key):
                setattr(role, key, value)

        await self.session.flush()
        return role

    async def delete_role(self, role_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
        """
        Xóa Role.
        """
        stmt = delete(RoleModel).where(
            and_(RoleModel.id == role_id, RoleModel.tenant_id == tenant_id)
        )
        result = await self.session.execute(stmt)
        if result.rowcount == 0:
            raise NotFoundError(f"Role {role_id} not found in tenant {tenant_id}")
        await self.session.flush()

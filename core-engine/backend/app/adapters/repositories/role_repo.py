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
        user_role = UserRoleModel(
            user_id=user_id, role_id=role_id, granted_by_user_id=granted_by
        )
        self.session.add(user_role)
        await self.session.flush()
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

        # permissions là một list of strings do dùng JSONB(astext_type=Text()), hoặc array of strings.
        # Ở đây Model định nghĩa permissions: Mapped[list[str]] = mapped_column(JSONB, default=list)
        all_permissions = set()
        for row in result.all():
            permissions_list = row[0]
            if permissions_list:
                all_permissions.update(permissions_list)

        return list(all_permissions)

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.domain.exceptions import NotFoundError
from app.infrastructure.models import UserModel


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_keycloak_id(self, keycloak_id: uuid.UUID) -> Optional[UserModel]:
        """
        Lấy thông tin User dựa vào keycloak_id.
        """
        stmt = select(UserModel).where(
            UserModel.keycloak_id == keycloak_id, UserModel.deleted_at.is_(None)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def upsert(self, user_data: dict) -> UserModel:
        """
        Thêm mới hoặc cập nhật thông tin User dựa vào keycloak_id (Idempotent).
        """
        stmt = insert(UserModel).values(**user_data)

        # Lấy các trường cần update nếu xảy ra conflict
        update_dict = {
            c.name: c
            for c in stmt.excluded
            if c.name not in ["id", "keycloak_id", "created_at"]
        }

        stmt = stmt.on_conflict_do_update(
            index_elements=["keycloak_id"], set_=update_dict
        ).returning(UserModel)

        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def deactivate(self, user_id: uuid.UUID) -> None:
        """
        Soft delete user.
        """
        from sqlalchemy.sql import func

        stmt = (
            update(UserModel)
            .where(UserModel.id == user_id, UserModel.deleted_at.is_(None))
            .values(is_active=False, deleted_at=func.now())
        )
        result = await self.session.execute(stmt)
        if result.rowcount == 0:
            raise NotFoundError(
                f"User with ID {user_id} not found or already deactivated"
            )

    async def list_by_tenant(
        self, tenant_id: uuid.UUID, limit: int = 100, offset: int = 0
    ) -> List[UserModel]:
        """
        Liệt kê danh sách users của một tenant cụ thể.
        """
        stmt = (
            select(UserModel)
            .where(UserModel.tenant_id == tenant_id, UserModel.deleted_at.is_(None))
            .order_by(UserModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

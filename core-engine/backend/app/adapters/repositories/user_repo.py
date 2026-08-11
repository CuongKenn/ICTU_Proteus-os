# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractUserRepository
from app.core.domain.entities import UserEntity
from app.core.domain.exceptions import NotFoundError
from app.infrastructure.models import UserModel


def _to_entity(model: UserModel) -> UserEntity:
    return UserEntity(
        id=model.id,
        tenant_id=model.tenant_id,
        keycloak_id=model.keycloak_id,
        email=model.email,
        full_name=model.full_name,
        is_active=model.is_active,
        # Roles should be populated from realm_access or separate table
        roles=[],
    )


class SQLAlchemyUserRepository(AbstractUserRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_keycloak_id(self, keycloak_id: uuid.UUID) -> UserEntity | None:
        """
        Lấy thông tin User dựa vào keycloak_id.
        """
        stmt = select(UserModel).where(
            UserModel.keycloak_id == keycloak_id,
            UserModel.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        model = result.scalars().first()
        if not model:
            return None
        return _to_entity(model)

    async def upsert(self, user_data: dict) -> UserEntity:
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
        model = result.scalar_one()
        return _to_entity(model)

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
    ) -> list[UserEntity]:
        """
        Liệt kê danh sách users của một tenant cụ thể.
        """
        stmt = (
            select(UserModel)
            .where(
                UserModel.tenant_id == tenant_id,
                UserModel.deleted_at.is_(None),
            )
            .order_by(UserModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        models = result.scalars().all()
        return [_to_entity(model) for model in models]

    async def commit(self) -> None:
        await self.session.commit()

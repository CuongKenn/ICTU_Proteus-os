# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.adapters.repositories.base import AbstractUserRepository
from app.core.domain.entities import UserEntity
from app.core.domain.exceptions import NotFoundError
from app.infrastructure.models import UserModel


def _to_entity(model: UserModel, roles: list[str] | None = None) -> UserEntity:
    """Convert ORM model to domain entity.

    QUAN TRỌNG: Không bao giờ access model.roles trực tiếp ở đây vì sẽ trigger
    SQLAlchemy lazy load trong async context -> MissingGreenlet error.
    Luôn truyền roles đã được eager-load thông qua tham số `roles`.
    """
    return UserEntity(
        id=model.id,
        tenant_id=model.tenant_id,
        keycloak_id=model.keycloak_id,
        email=model.email,
        full_name=model.full_name,
        is_active=model.is_active,
        roles=roles if roles is not None else [],
    )


class SQLAlchemyUserRepository(AbstractUserRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: uuid.UUID) -> UserEntity | None:
        """Lấy User bằng ID trong DB."""
        stmt = (
            select(UserModel)
            .where(UserModel.id == user_id, UserModel.deleted_at.is_(None))
            .options(selectinload(UserModel.roles))
        )
        result = await self.session.execute(stmt)
        model = result.scalars().first()
        if not model:
            return None

        loaded_roles = [role.name for role in model.__dict__.get("roles", [])]
        return _to_entity(model, roles=loaded_roles)

    async def get_by_keycloak_id(self, keycloak_id: uuid.UUID) -> UserEntity | None:
        """
        Lấy thông tin User dựa vào keycloak_id.
        Dùng selectinload để eager-load roles trong cùng 1 query.
        """
        stmt = (
            select(UserModel)
            .where(
                UserModel.keycloak_id == keycloak_id,
                UserModel.deleted_at.is_(None),
            )
            .options(selectinload(UserModel.roles))
        )

        result = await self.session.execute(stmt)
        model = result.scalars().first()
        if not model:
            return None
        # Roles đã được eager-load, lấy an toàn từ model.__dict__
        loaded_roles = [role.name for role in model.__dict__.get("roles", [])]
        return _to_entity(model, roles=loaded_roles)

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

        # Flush để đảm bảo record đã có trong DB trước khi reload
        await self.session.flush()

        # Reload với eager-load roles để tránh MissingGreenlet
        entity = await self.get_by_keycloak_id(model.keycloak_id)
        if not entity:
            # Fallback an toàn: KHÔNG access model.roles (lazy load = crash)
            return _to_entity(model, roles=[])
        return entity

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
            .options(selectinload(UserModel.roles))
            .order_by(UserModel.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        models = result.scalars().all()
        entities = []
        for model in models:
            loaded_roles = [role.name for role in model.__dict__.get("roles", [])]
            entities.append(_to_entity(model, roles=loaded_roles))
        return entities

    async def commit(self) -> None:
        await self.session.commit()

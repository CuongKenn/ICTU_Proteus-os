# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from datetime import datetime, timezone

from app.adapters.repositories.base import AbstractUserRepository
from app.core.domain.entities import TenantContext, UserEntity


class UserProvisioningUseCase:
    """
    Use Case: User Provisioning.
    Đồng bộ user profile từ Keycloak JWT (TenantContext) vào PostgreSQL.
    """

    def __init__(self, user_repo: AbstractUserRepository):
        self.user_repo = user_repo

    async def sync_user_profile(self, tenant_context: TenantContext) -> UserEntity:
        """
        Thực hiện First Login Provisioning:
        - Nếu chưa có trong DB: INSERT mới.
        - Nếu có rồi: UPDATE last_login_at, email, full_name.
        """
        user_data = {
            "tenant_id": tenant_context.tenant_id,
            "keycloak_id": tenant_context.user_id,
            "email": tenant_context.email,
            "full_name": tenant_context.full_name,
            "last_login_at": datetime.now(timezone.utc),
            "is_active": True,
        }

        user_entity = await self.user_repo.upsert(user_data)
        await self.user_repo.commit()

        # Merge roles from Keycloak JWT into UserEntity response
        user_entity.roles = tenant_context.roles

        return user_entity

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
import re
import uuid
from dataclasses import dataclass

from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.repositories.base import (
    AbstractTenantRepository,
    AbstractUserRepository,
)
from app.core.domain.entities import TenantEntity, UserEntity

logger = logging.getLogger(__name__)


@dataclass
class OnboardingRequest:
    company_name: str
    admin_full_name: str
    admin_email: str
    admin_password: str


class OnboardingUseCase:
    """
    Use Case xử lý luồng đăng ký trực tuyến (SaaS Onboarding).
    """

    def __init__(
        self,
        tenant_repo: AbstractTenantRepository,
        user_repo: AbstractUserRepository,
        keycloak_adapter: KeycloakAdapter,
    ) -> None:
        self.tenant_repo = tenant_repo
        self.user_repo = user_repo
        self.keycloak_adapter = keycloak_adapter

    def _generate_slug(self, name: str) -> str:
        """Tạo slug đơn giản từ tên công ty."""
        slug = name.lower()
        slug = re.sub(r"[^a-z0-9]+", "-", slug)
        slug = slug.strip("-")
        if not slug:
            slug = f"tenant-{uuid.uuid4().hex[:8]}"
        return slug

    async def execute(self, req: OnboardingRequest) -> dict[str, str]:
        logger.info(
            "Bắt đầu xử lý đăng ký Tenant mới",
            extra={"email": req.admin_email, "company": req.company_name},
        )

        # 1. Tạo Tenant ID & Slug
        tenant_id = uuid.uuid4()
        base_slug = self._generate_slug(req.company_name)

        # Đảm bảo slug unique
        slug = base_slug
        counter = 1
        while await self.tenant_repo.get_by_slug(slug) is not None:
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Mặc định sử dụng realm "proteus" chung cho tất cả Tenant (Multi-tenant trong 1 realm)
        # Thuộc tính tenant_id trong JWT sẽ đảm nhiệm việc phân tách dữ liệu.
        keycloak_realm = "proteus"

        # 2. Tạo User trên Keycloak với tenant_id
        try:
            # Thuộc tính này sẽ được mapper map vào token dưới dạng claim "tenant_id"
            user_attributes = {"tenant_id": [str(tenant_id)]}

            # Username mặc định là email, có thể tách riêng tuỳ hệ thống
            keycloak_user_id = await self.keycloak_adapter.create_user(
                realm=keycloak_realm,
                username=req.admin_email,
                email=req.admin_email,
                first_name=req.admin_full_name.split(" ")[0],
                last_name=(
                    " ".join(req.admin_full_name.split(" ")[1:])
                    if " " in req.admin_full_name
                    else ""
                ),
                attributes=user_attributes,
            )
        except ValueError as e:
            # User already exists
            logger.warning(
                "Đăng ký thất bại: Email đã tồn tại", extra={"email": req.admin_email}
            )
            raise ValueError("Email đã được sử dụng") from e

        try:
            # 3. Đặt mật khẩu cho User
            await self.keycloak_adapter.set_user_password(
                realm=keycloak_realm,
                user_id=keycloak_user_id,
                password=req.admin_password,
            )

            # 4. Gán role tenant_admin
            await self.keycloak_adapter.assign_role_to_user(
                realm=keycloak_realm, user_id=keycloak_user_id, role_name="tenant_admin"
            )
        except Exception as e:
            logger.error("Lỗi cấu hình Keycloak User", exc_info=True)
            # Rollback handling could be added here (delete user from keycloak)
            raise RuntimeError(f"Lỗi hệ thống khi cấu hình tài khoản: {str(e)}") from e

        # 5. Lưu Tenant vào Database
        tenant_entity = TenantEntity(
            id=tenant_id,
            name=req.company_name,
            slug=slug,
            keycloak_realm=keycloak_realm,
            is_active=True,
        )
        await self.tenant_repo.create(tenant_entity)

        # 6. Lưu User vào Database
        user_entity = UserEntity(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            keycloak_id=uuid.UUID(keycloak_user_id),
            email=req.admin_email,
            full_name=req.admin_full_name,
            is_active=True,
        )
        # user_repo dùng upsert method
        await self.user_repo.upsert(
            {
                "id": user_entity.id,
                "tenant_id": user_entity.tenant_id,
                "keycloak_id": user_entity.keycloak_id,
                "email": user_entity.email,
                "full_name": user_entity.full_name,
                "is_active": user_entity.is_active,
            }
        )

        await self.user_repo.commit()

        logger.info(
            "Đăng ký Tenant thành công",
            extra={"tenant_id": str(tenant_id), "keycloak_id": keycloak_user_id},
        )

        return {
            "tenant_id": str(tenant_id),
            "slug": slug,
            "user_id": keycloak_user_id,
            "message": "Đăng ký thành công",
        }

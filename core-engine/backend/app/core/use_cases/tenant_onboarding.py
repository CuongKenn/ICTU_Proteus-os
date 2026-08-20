# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Tenant Onboarding Use Case

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.repositories.base import AbstractTenantRepository
from app.core.domain.entities import (
    TenantContext,
    TenantEntity,
    TenantIntegrationEntity,
)

logger = logging.getLogger(__name__)


class TenantOnboardingError(Exception):
    """Lỗi nghiệp vụ liên quan đến Tenant Onboarding."""

    pass


class TenantPermissionError(TenantOnboardingError):
    """Lỗi không có quyền thực hiện."""

    pass


class TenantOnboardingUseCase:
    """
    Quản lý vòng đời Tenant (Tổ chức).
    Chỉ superadmin mới được phép tạo Tenant.
    """

    def __init__(
        self,
        tenant_repo: AbstractTenantRepository,
        keycloak_adapter: KeycloakAdapter,
        session: AsyncSession,
    ) -> None:
        self.tenant_repo = tenant_repo
        self.keycloak_adapter = keycloak_adapter
        self.session = session

    def _require_superadmin(self, context: TenantContext) -> None:
        if "superadmin" not in context.roles:
            raise TenantPermissionError(
                "Chỉ superadmin mới có quyền thực hiện hành động này."
            )

    async def create_tenant(
        self, context: TenantContext, name: str, slug: str, plan: str
    ) -> TenantEntity:
        self._require_superadmin(context)

        # Validate slug
        existing = await self.tenant_repo.get_by_slug(slug)
        if existing:
            raise TenantOnboardingError(f"Tenant với slug '{slug}' đã tồn tại.")

        tenant_id = uuid.uuid4()

        # Trong kiến trúc Proteus, giả định dùng 1 Shared Realm,
        # tạo Group cho mỗi Tenant
        # Hoặc Realm riêng nếu keycloak_realm là slug.
        # Ở đây ta lưu realm = "master" (hoặc từ settings) và tạo Group theo slug.
        # Tạm lưu realm là "proteus"
        realm = "proteus"

        new_tenant = TenantEntity(
            id=tenant_id,
            name=name,
            slug=slug,
            keycloak_realm=realm,
            plan=plan,
            is_active=True,
        )

        # 1. Create in DB
        created_tenant = await self.tenant_repo.create(new_tenant)

        # 2. Create Keycloak Group (Best effort / Saga)
        # Giả định token admin đã có ở adapter hoặc truyền rỗng vì ta đang dùng client
        try:
            # We use client credentials in the adapter now
            await self.keycloak_adapter.create_tenant_group(
                realm=realm,
                group_name=f"tenant_{slug}",
            )
        except Exception as e:
            logger.error("Không thể tạo Keycloak group cho tenant %s: %s", slug, e)
            # Ở môi trường thực tế, nếu gọi KC lỗi, có thể cần rollback DB hoặc retry sau
            # Ở đây ta rollback giao dịch (nếu dùng chung self.session)
            # Vì AbstractTenantRepository không tự commit, ta có thể không commit.
            msg = f"Lỗi tạo Tenant Group trên Keycloak: {e}"
            raise TenantOnboardingError(msg) from e

        return created_tenant

    async def get_tenant(
        self, context: TenantContext, tenant_id: uuid.UUID
    ) -> TenantEntity:
        # User chỉ có quyền lấy thông tin Tenant của chính mình, trừ phi là superadmin
        tenant = await self.tenant_repo.get_by_id(tenant_id)
        if not tenant:
            raise TenantOnboardingError("Tenant không tồn tại.")
        if tenant.id != context.tenant_id and "superadmin" not in context.roles:
            raise TenantPermissionError("Không có quyền truy cập Tenant này.")
        return tenant

    async def update_tenant(
        self, context: TenantContext, tenant_id: uuid.UUID, data: dict[str, Any]
    ) -> TenantEntity:
        self._require_superadmin(context)

        tenant = await self.tenant_repo.get_by_id(tenant_id)
        if not tenant:
            raise TenantOnboardingError("Tenant không tồn tại.")

        # Loại bỏ các trường không cho phép update
        safe_data = {
            k: v for k, v in data.items() if k in ["name", "plan", "is_active"]
        }

        if not safe_data:
            return tenant

        updated = await self.tenant_repo.update(tenant_id, safe_data)
        return updated

    async def delete_tenant(self, context: TenantContext, tenant_id: uuid.UUID) -> None:
        self._require_superadmin(context)

        tenant = await self.tenant_repo.get_by_id(tenant_id)
        if not tenant:
            raise TenantOnboardingError("Tenant không tồn tại.")

        await self.tenant_repo.soft_delete(tenant_id)

    async def get_integrations(
        self, context: TenantContext
    ) -> list[TenantIntegrationEntity]:
        if "tenant_admin" not in context.roles and "superadmin" not in context.roles:
            raise TenantPermissionError(
                "Chỉ tenant_admin mới có quyền xem integrations."
            )
        return await self.tenant_repo.get_integrations(context.tenant_id)

    async def add_integration(
        self, context: TenantContext, provider: str, config: dict[str, Any]
    ) -> TenantIntegrationEntity:
        if "tenant_admin" not in context.roles and "superadmin" not in context.roles:
            raise TenantPermissionError(
                "Chỉ tenant_admin mới có quyền thêm integration."
            )
        integration = TenantIntegrationEntity(
            id=uuid.uuid4(),
            tenant_id=context.tenant_id,
            provider=provider,
            config=config,
            is_active=True,
        )
        return await self.tenant_repo.add_integration(integration)

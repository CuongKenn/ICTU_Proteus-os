# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Tenant Repository

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractTenantRepository
import json
from app.core.domain.entities import TenantEntity, TenantIntegrationEntity


class SQLAlchemyTenantRepository(AbstractTenantRepository):
    """
    Implementation của AbstractTenantRepository sử dụng SQLAlchemy text().
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _to_entity(self, row: dict) -> TenantEntity:
        return TenantEntity(
            id=row["id"],
            name=row["name"],
            slug=row["slug"],
            keycloak_realm=row["keycloak_realm"],
            plan=row["plan"],
            is_active=row["is_active"],
        )

    async def get_by_id(self, tenant_id: uuid.UUID) -> TenantEntity | None:
        result = await self._session.execute(
            text("SELECT * FROM tenants WHERE id = :id AND deleted_at IS NULL"),
            {"id": tenant_id},
        )
        row = result.mappings().first()
        if not row:
            return None
        return self._to_entity(dict(row))

    async def get_by_slug(self, slug: str) -> TenantEntity | None:
        result = await self._session.execute(
            text("SELECT * FROM tenants WHERE slug = :slug AND deleted_at IS NULL"),
            {"slug": slug},
        )
        row = result.mappings().first()
        if not row:
            return None
        return self._to_entity(dict(row))

    async def create(self, tenant: TenantEntity) -> TenantEntity:
        await self._session.execute(
            text("""
                INSERT INTO tenants (id, name, slug, keycloak_realm, plan, is_active)
                VALUES (:id, :name, :slug, :keycloak_realm, :plan, :is_active)
                """),
            {
                "id": tenant.id,
                "name": tenant.name,
                "slug": tenant.slug,
                "keycloak_realm": tenant.keycloak_realm,
                "plan": tenant.plan,
                "is_active": tenant.is_active,
            },
        )
        return tenant

    async def update(self, tenant_id: uuid.UUID, data: dict) -> TenantEntity:
        set_clauses = []
        for key in data.keys():
            set_clauses.append(f"{key} = :{key}")

        if not set_clauses:
            return await self.get_by_id(tenant_id)

        sql = f"UPDATE tenants SET {', '.join(set_clauses)} WHERE id = :id AND deleted_at IS NULL RETURNING *"
        params = data.copy()
        params["id"] = tenant_id

        result = await self._session.execute(text(sql), params)
        row = result.mappings().first()
        return self._to_entity(dict(row))

    async def soft_delete(self, tenant_id: uuid.UUID) -> None:
        await self._session.execute(
            text("UPDATE tenants SET deleted_at = CURRENT_TIMESTAMP WHERE id = :id"),
            {"id": tenant_id},
        )

    async def get_integrations(
        self, tenant_id: uuid.UUID
    ) -> list[TenantIntegrationEntity]:
        result = await self._session.execute(
            text(
                "SELECT * FROM tenant_integrations WHERE tenant_id = :tenant_id AND deleted_at IS NULL"
            ),
            {"tenant_id": tenant_id},
        )
        rows = result.mappings().all()
        return [
            TenantIntegrationEntity(
                id=row["id"],
                tenant_id=row["tenant_id"],
                provider=row["provider"],
                config=(
                    row["config"]
                    if isinstance(row["config"], dict)
                    else json.loads(row["config"])
                ),
                is_active=row["is_active"],
            )
            for row in rows
        ]

    async def add_integration(
        self, integration: TenantIntegrationEntity
    ) -> TenantIntegrationEntity:
        await self._session.execute(
            text("""
                INSERT INTO tenant_integrations (id, tenant_id, provider, config, is_active)
                VALUES (:id, :tenant_id, :provider, :config, :is_active)
                """),
            {
                "id": integration.id,
                "tenant_id": integration.tenant_id,
                "provider": integration.provider,
                "config": json.dumps(integration.config),
                "is_active": integration.is_active,
            },
        )
        return integration

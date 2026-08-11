# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — FastAPI Dependency Injection
# Cung cấp các Depends() để inject vào Router handlers.
# Đây là nơi duy nhất ánh xạ HTTP Request → Domain TenantContext.

from __future__ import annotations

import logging
import uuid

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.appsmith_adapter import AppsmithAdapter
from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.external.metabase_adapter import MetabaseAdapter
from app.adapters.external.n8n_adapter import N8nAdapter
from app.adapters.external.redis_event_bus import RedisEventBusPublisher
from app.adapters.repositories.base import (
    AbstractPluginRepository,
    AbstractUserRepository,
)
from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
from app.adapters.repositories.user_repo import SQLAlchemyUserRepository
from app.core.domain.entities import TenantContext
from app.core.use_cases.plugin_list import PluginListUseCase
from app.core.use_cases.user_provisioning import UserProvisioningUseCase
from app.infrastructure.database import get_db_readonly

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=True)


async def get_plugin_repo(
    db: AsyncSession = Depends(get_db_readonly),
) -> AbstractPluginRepository:
    """Inject Plugin Repository."""
    return SQLAlchemyPluginRepository(session=db)


async def get_keycloak_adapter(request: Request) -> KeycloakAdapter:
    """Inject KeycloakAdapter."""
    return KeycloakAdapter(client=request.app.state.http_client)


async def get_n8n_adapter(request: Request) -> N8nAdapter:
    """Inject N8nAdapter."""
    return N8nAdapter(client=request.app.state.http_client)


async def get_metabase_adapter(request: Request) -> MetabaseAdapter:
    """Inject MetabaseAdapter."""
    return MetabaseAdapter(client=request.app.state.http_client)


async def get_appsmith_adapter(request: Request) -> AppsmithAdapter:
    """Inject AppsmithAdapter."""
    return AppsmithAdapter(client=request.app.state.http_client)


async def get_redis_event_bus(request: Request) -> RedisEventBusPublisher:
    """Inject RedisEventBusPublisher."""
    return request.app.state.redis_event_bus


async def get_plugin_list_use_case(
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
) -> PluginListUseCase:
    """Inject Plugin List Use Case."""
    return PluginListUseCase(plugin_repo=repo)


async def get_current_tenant_context(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    keycloak_adapter: KeycloakAdapter = Depends(get_keycloak_adapter),
) -> TenantContext:
    """
    Extract và validate JWT Token.
    Trả về TenantContext để truyền vào Use Cases.

    Notes:
        - Token được Next.js BFF inject vào
          header "Authorization: Bearer <token>"
        - Browser KHÔNG bao giờ gọi trực tiếp endpoint này
          với token tự mang theo
    """
    # Bước 1: Verify JWT signature
    # (chỉ catch JWTError, không catch HTTPException)
    try:
        payload = await keycloak_adapter.verify_and_decode_token(
            credentials.credentials
        )
    except JWTError as exc:
        logger.warning("Invalid JWT token received", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # Bước 2: Extract claims — raise 401 nếu thiếu field bắt buộc
    tenant_id_raw = payload.get("tenant_id") or payload.get("azp")
    user_id_raw = payload.get("sub")

    if not tenant_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token thiếu claim tenant_id.",
        )
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token thiếu claim sub (user_id).",
        )

    # Bước 3: Parse UUID — bắt ValueError nếu format không hợp lệ
    try:
        tenant_id = uuid.UUID(str(tenant_id_raw))
        user_id = uuid.UUID(str(user_id_raw))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token chứa tenant_id hoặc user_id không hợp lệ.",
        ) from exc

    realm_access = payload.get("realm_access", {})
    roles = realm_access.get("roles", [])
    name_claim = payload.get("name")
    pref_username = payload.get("preferred_username")
    full_name = name_claim or pref_username or "Unknown"

    return TenantContext(
        tenant_id=tenant_id,
        user_id=user_id,
        roles=roles,
        email=payload.get("email", ""),
        full_name=full_name,
    )


async def get_user_repo(
    db: AsyncSession = Depends(get_db_readonly),
) -> AbstractUserRepository:
    """Inject User Repository."""
    return SQLAlchemyUserRepository(session=db)


async def get_user_provisioning_use_case(
    repo: AbstractUserRepository = Depends(get_user_repo),
) -> UserProvisioningUseCase:
    """Inject User Provisioning Use Case."""
    return UserProvisioningUseCase(user_repo=repo)

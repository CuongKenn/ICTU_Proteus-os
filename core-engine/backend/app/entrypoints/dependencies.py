# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — FastAPI Dependency Injection
# Cung cấp các Depends() để inject vào Router handlers.
# Đây là nơi duy nhất ánh xạ HTTP Request → Domain TenantContext.

from __future__ import annotations

import logging
import uuid

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
from app.core.domain.entities import TenantContext
from app.infrastructure.database import AsyncSession, get_db

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=True)
_keycloak_adapter = KeycloakAdapter()


async def get_plugin_repo(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyPluginRepository:
    """Inject Plugin Repository."""
    return SQLAlchemyPluginRepository(session=db)


async def get_current_tenant_context(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> TenantContext:
    """
    Extract và validate JWT Token.
    Trả về TenantContext để truyền vào Use Cases.

    Notes:
        - Token được Next.js BFF (BFF Pattern) inject vào header "Authorization: Bearer <token>"
        - Browser KHÔNG bao giờ gọi trực tiếp endpoint này với token tự mang theo
    """
    try:
        payload = await _keycloak_adapter.verify_and_decode_token(
            credentials.credentials
        )
        tenant_id_raw = payload.get("tenant_id") or payload.get("azp")
        user_id_raw = payload.get("sub")

        if not tenant_id_raw or not user_id_raw:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token thiếu thông tin tenant_id hoặc sub.",
            )

        realm_access = payload.get("realm_access", {})
        roles = realm_access.get("roles", [])

        return TenantContext(
            tenant_id=uuid.UUID(str(tenant_id_raw)),
            user_id=uuid.UUID(str(user_id_raw)),
            roles=roles,
            email=payload.get("email", ""),
        )

    except Exception as exc:
        logger.warning("Authentication failed", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

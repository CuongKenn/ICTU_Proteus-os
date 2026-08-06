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
from jose import JWTError

from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
from app.core.domain.entities import TenantContext
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.database import get_db

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
        - Token được Next.js BFF inject vào header "Authorization: Bearer <token>"
        - Browser KHÔNG bao giờ gọi trực tiếp endpoint này với token tự mang theo
    """
    # Bước 1: Verify JWT signature — chỉ catch JWTError, không catch HTTPException
    try:
        payload = await _keycloak_adapter.verify_and_decode_token(
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

    return TenantContext(
        tenant_id=tenant_id,
        user_id=user_id,
        roles=roles,
        email=payload.get("email", ""),
    )

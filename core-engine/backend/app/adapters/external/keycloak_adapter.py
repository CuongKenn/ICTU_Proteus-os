# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Keycloak Integration
# Giao tiếp với Keycloak Admin API và xác thực JWT Token

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, cast

import httpx
from jose import jwt

from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class KeycloakAdapter:
    """
    Adapter giao tiếp với Keycloak.
    - Xác thực JWT (verify signature qua JWKS)
    - Lấy thông tin User / Role từ Access Token
    - Gọi Admin API để tạo/xóa Role khi cài/gỡ Plugin
    """

    # JWKS TTL: 1 giờ — Keycloak thường rotate keys định kỳ
    _JWKS_TTL_SECONDS: float = 3600.0

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._jwks_cache: dict[str, Any] | None = None
        self._jwks_cached_at: float = 0.0
        self._jwks_lock = asyncio.Lock()
        # Nếu không truyền client (VD: fallback hoặc test),
        # tạo mới nhưng không tối ưu pooling
        self._client = client or httpx.AsyncClient()

    async def _get_jwks(self) -> dict[str, Any]:
        """
        Lấy JWKS từ Keycloak với in-memory cache có TTL.
        Cache expire sau 1 giờ để tự động nhận keys mới khi Keycloak rotate.
        """
        now = time.monotonic()
        if (
            self._jwks_cache is not None
            and (now - self._jwks_cached_at) < self._JWKS_TTL_SECONDS
        ):
            return self._jwks_cache

        async with self._jwks_lock:
            # Double-check sau khi có lock
            now_locked = time.monotonic()
            if (
                self._jwks_cache is not None
                and (now_locked - self._jwks_cached_at) < self._JWKS_TTL_SECONDS
            ):
                return self._jwks_cache

            logger.debug(
                "Fetching JWKS from Keycloak", extra={"url": settings.keycloak_jwks_url}
            )
            response = await self._client.get(settings.keycloak_jwks_url, timeout=10.0)
            response.raise_for_status()
            self._jwks_cache = response.json()
            self._jwks_cached_at = now_locked
            logger.info("JWKS cache refreshed")
            return self._jwks_cache

    async def verify_and_decode_token(self, token: str) -> dict[str, Any]:
        """
        Xác thực Access Token JWT.
        Trả về payload đã decode nếu hợp lệ.
        Raise JWTError nếu token không hợp lệ hoặc hết hạn.
        """
        jwks = await self._get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.KEYCLOAK_CLIENT_ID,
            options={"verify_exp": True},
        )
        logger.debug(
            "Token verified successfully",
            extra={"user_id": payload.get("sub"), "tenant": payload.get("tenant_id")},
        )
        return cast(dict[str, Any], payload)

    async def get_admin_token(self) -> str:
        """Lấy token của admin-cli qua Client Credentials Grant để gọi Admin API."""
        url = f"{settings.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": settings.KEYCLOAK_ADMIN_CLIENT_ID,
            "client_secret": settings.KEYCLOAK_ADMIN_CLIENT_SECRET,
        }
        response = await self._client.post(url, data=data, timeout=10.0)
        response.raise_for_status()
        return response.json()["access_token"]

    async def create_role(
        self,
        realm: str,
        role_name: str,
    ) -> None:
        """Tạo Role trong Keycloak Realm của Tenant khi cài Plugin."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/roles"
        response = await self._client.post(
            url,
            json={"name": role_name},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        if response.status_code == 409:
            logger.warning("Role already exists in Keycloak", extra={"role": role_name})
            return
        response.raise_for_status()
        logger.info("Keycloak role created", extra={"role": role_name, "realm": realm})

    async def delete_role(
        self,
        realm: str,
        role_name: str,
    ) -> None:
        """Xóa Role khỏi Keycloak Realm của Tenant khi gỡ Plugin."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/roles/{role_name}"
        response = await self._client.delete(
            url,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        if response.status_code == 404:
            logger.warning("Role not found in Keycloak", extra={"role": role_name})
            return
        response.raise_for_status()
        logger.info("Keycloak role deleted", extra={"role": role_name, "realm": realm})

    async def create_tenant_group(
        self,
        realm: str,
        group_name: str,
    ) -> None:
        """Tạo Group cho Tenant trong Keycloak Realm."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/groups"
        response = await self._client.post(
            url,
            json={"name": group_name},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        if response.status_code == 409:
            logger.warning(
                "Group already exists in Keycloak", extra={"group": group_name}
            )
            return
        response.raise_for_status()
        logger.info(
            "Keycloak group created", extra={"group": group_name, "realm": realm}
        )

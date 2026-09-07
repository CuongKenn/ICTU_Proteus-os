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

from app.core.domain.ports import AbstractIdentityProviderPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class KeycloakAdapter(AbstractIdentityProviderPort):
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

    async def aclose(self) -> None:
        """Đóng httpx client. Nên được gọi khi application shutdown."""
        await self._client.aclose()

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
            if (
                self._jwks_cache is not None
                and (now - self._jwks_cached_at) < self._JWKS_TTL_SECONDS
            ):
                return self._jwks_cache

            logger.debug(
                "Fetching JWKS from Keycloak", extra={"url": settings.keycloak_jwks_url}
            )
            response = await self._client.get(settings.keycloak_jwks_url, timeout=10.0)
            response.raise_for_status()
            self._jwks_cache = response.json()
            self._jwks_cached_at = time.monotonic()
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
        """Lấy token của admin-cli qua Password Grant để gọi Admin API."""
        url = f"{settings.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"
        data = {
            "grant_type": "password",
            "client_id": settings.KEYCLOAK_ADMIN_CLIENT_ID,
            "username": settings.KEYCLOAK_ADMIN_USER,
            "password": settings.KEYCLOAK_ADMIN_PASSWORD,
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

    async def get_role(self, realm: str, role_name: str) -> dict[str, Any]:
        """Lấy thông tin Role từ Keycloak để lấy ID."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/roles/{role_name}"
        response = await self._client.get(
            url,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()

    async def create_user(
        self,
        realm: str,
        username: str,
        email: str,
        first_name: str,
        last_name: str,
        attributes: dict[str, list[str]],
    ) -> str:
        """Tạo User trong Keycloak, trả về user_id (sub)."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users"
        user_data = {
            "username": username,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "enabled": True,
            "emailVerified": True,
            "attributes": attributes,
        }
        response = await self._client.post(
            url,
            json=user_data,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        
        if response.status_code == 409:
            raise ValueError(f"User with email {email} already exists in Keycloak")
            
        response.raise_for_status()
        
        # Keycloak POST /users returns 201 Created with Location header containing the ID
        location = response.headers.get("Location")
        if not location:
            # Fallback: search by email to get ID
            search_url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users?email={email}&exact=true"
            search_res = await self._client.get(search_url, headers={"Authorization": f"Bearer {admin_token}"})
            search_res.raise_for_status()
            users = search_res.json()
            if not users:
                raise RuntimeError("Created user not found")
            return users[0]["id"]
            
        return location.split("/")[-1]

    async def set_user_password(
        self, realm: str, user_id: str, password: str
    ) -> None:
        """Đặt mật khẩu cho user."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}/reset-password"
        payload = {
            "type": "password",
            "value": password,
            "temporary": False
        }
        response = await self._client.put(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()

    async def assign_role_to_user(
        self, realm: str, user_id: str, role_name: str
    ) -> None:
        """Gán Role cho User (Realm Role)."""
        role = await self.get_role(realm, role_name)
        admin_token = await self.get_admin_token()
        
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}/role-mappings/realm"
        response = await self._client.post(
            url,
            json=[role],
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()

    async def send_invite_email(
        self, realm: str, user_id: str, redirect_uri: str | None = None
    ) -> None:
        """
        Kích hoạt luồng mời nhân viên qua email.
        Keycloak gửi email chứa link để user tự đặt mật khẩu và xác thực email.
        Yêu cầu SMTP được cấu hình trong Keycloak Realm Settings → Email.
        """
        admin_token = await self.get_admin_token()
        url = (
            f"{settings.KEYCLOAK_URL}/admin/realms/{realm}"
            f"/users/{user_id}/execute-actions-email"
        )
        params: dict[str, str] = {}
        if redirect_uri:
            params["redirect_uri"] = redirect_uri

        response = await self._client.put(
            url,
            json=["UPDATE_PASSWORD", "VERIFY_EMAIL"],
            params=params,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15.0,
        )
        # 204 No Content = thành công; 400 = SMTP chưa cấu hình
        if response.status_code == 400:
            detail = response.json().get("errorMessage", response.text)
            raise RuntimeError(
                f"Không thể gửi email mời. Keycloak lỗi: {detail}. "
                "Kiểm tra SMTP tại Keycloak Admin → Realm Settings → Email."
            )
        response.raise_for_status()
        logger.info(
            "Invite email sent via Keycloak",
            extra={"user_id": user_id, "realm": realm},
        )

    async def disable_user(self, realm: str, user_id: str) -> None:
        """Vô hiệu hóa User trên Keycloak (enabled=false)."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}"
        response = await self._client.put(
            url,
            json={"enabled": False},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()
        logger.info(
            "User disabled on Keycloak",
            extra={"user_id": user_id, "realm": realm},
        )

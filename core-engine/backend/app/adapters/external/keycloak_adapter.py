# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Keycloak Integration
# Giao tiếp với Keycloak Admin API và xác thực JWT Token

from __future__ import annotations

import asyncio
import logging
import time
import uuid as uuid_lib
from typing import Any, cast

import httpx
from jose import jwt

from app.core.domain.ports import AbstractIdentityProviderPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


def mattermost_numeric_id(keycloak_user_id: str) -> int:
    """ID số ổn định cho Mattermost SSO (đòi int64 khác 0).

    Mattermost parse `id` trong userinfo thành int64 và reject id=0, trong khi
    Keycloak sub là UUID string. Lấy 8 byte đầu UUID → int63 dương (va chạm
    không đáng kể), fallback 1 nếu bằng 0.
    """
    try:
        n = int.from_bytes(
            uuid_lib.UUID(str(keycloak_user_id)).bytes[:8], "big"
        ) & 0x7FFFFFFFFFFFFFFF
    except ValueError:
        n = 0
    return n or 1


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

    async def get_group_by_name(self, realm: str, group_name: str) -> str | None:
        """Tìm Group ID theo tên Group trong Keycloak."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/groups"
        response = await self._client.get(
            url,
            params={"search": group_name, "exact": "true"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()
        groups = response.json()
        if not groups:
            return None
        # Đảm bảo match chính xác tên vì API search có thể trả về group con
        for group in groups:
            if group.get("name") == group_name:
                return group.get("id")
        return None

    async def add_user_to_group(self, realm: str, user_id: str, group_id: str) -> None:
        """Thêm User vào Group trong Keycloak."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}/groups/{group_id}"
        response = await self._client.put(
            url,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()

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
        email_verified: bool = True,
    ) -> str:
        """Tạo User trong Keycloak, trả về user_id (sub).

        email_verified=False cho luồng mời nhân viên: giữ user ở trạng thái
        "chờ kích hoạt" để required action VERIFY_EMAIL có ý nghĩa.
        """
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users"
        user_data = {
            "username": username,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "enabled": True,
            "emailVerified": email_verified,
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
            search_res = await self._client.get(
                search_url, headers={"Authorization": f"Bearer {admin_token}"}
            )
            search_res.raise_for_status()
            users = search_res.json()
            if not users:
                raise RuntimeError("Created user not found")
            return users[0]["id"]

        return location.split("/")[-1]

    async def set_user_password(self, realm: str, user_id: str, password: str) -> None:
        """Đặt mật khẩu cho user."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}/reset-password"
        payload = {"type": "password", "value": password, "temporary": False}
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

    async def revoke_role_from_user(
        self, realm: str, user_id: str, role_name: str
    ) -> None:
        """Thu hồi Role từ User (Realm Role)."""
        role = await self.get_role(realm, role_name)
        admin_token = await self.get_admin_token()

        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}/role-mappings/realm"
        request = httpx.Request(
            "DELETE",
            url,
            json=[role],
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        response = await self._client.send(request, timeout=10.0)
        response.raise_for_status()

    async def send_invite_email(
        self,
        realm: str,
        user_id: str,
        redirect_uri: str | None = None,
        client_id: str | None = None,
    ) -> None:
        """
        Kích hoạt luồng mời nhân viên qua email.
        Keycloak gửi email chứa link để user tự đặt mật khẩu và xác thực email.
        Yêu cầu SMTP được cấu hình trong Keycloak Realm Settings → Email.

        LƯU Ý: khi truyền redirect_uri BẮT BUỘC kèm client_id, nếu không
        Keycloak trả 400 "Client id missing" và mail không bao giờ được gửi.
        """
        admin_token = await self.get_admin_token()
        url = (
            f"{settings.KEYCLOAK_URL}/admin/realms/{realm}"
            f"/users/{user_id}/execute-actions-email"
        )
        params: dict[str, str] = {}
        if redirect_uri:
            params["redirect_uri"] = redirect_uri
            if client_id:
                params["client_id"] = client_id

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

    async def get_user(self, realm: str, user_id: str) -> dict[str, Any]:
        """Lấy full UserRepresentation từ Keycloak (cần cho update an toàn)."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}"
        response = await self._client.get(
            url,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()

    async def set_user_attributes(
        self, realm: str, user_id: str, attributes: dict[str, list[str]]
    ) -> None:
        """Merge attributes vào Keycloak user (giữ nguyên attributes cũ).

        CẢNH BÁO: Keycloak PUT /users/{id} là REPLACE toàn bộ representation —
        gửi partial body sẽ XÓA email/tên/attributes (đã gây lỗi login thực tế).
        Luôn GET full → merge → PUT.
        """
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}"
        user_rep = await self.get_user(realm, user_id)
        merged = dict(user_rep.get("attributes") or {})
        merged.update(attributes)
        user_rep["attributes"] = merged
        response = await self._client.put(
            url,
            json=user_rep,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()
        logger.info(
            "User attributes updated on Keycloak",
            extra={"user_id": user_id, "realm": realm, "keys": sorted(attributes)},
        )

    async def disable_user(self, realm: str, user_id: str) -> None:
        """Vô hiệu hóa User trên Keycloak (enabled=false, giữ mọi field khác)."""
        admin_token = await self.get_admin_token()
        url = f"{settings.KEYCLOAK_URL}/admin/realms/{realm}/users/{user_id}"
        user_rep = await self.get_user(realm, user_id)
        user_rep["enabled"] = False
        response = await self._client.put(
            url,
            json=user_rep,
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10.0,
        )
        response.raise_for_status()
        logger.info(
            "User disabled on Keycloak",
            extra={"user_id": user_id, "realm": realm},
        )

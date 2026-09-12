# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
import logging
from typing import Any

import httpx

from app.core.domain.ports import AbstractChatOpsPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class MattermostAdapterError(Exception):
    pass


class MattermostAdapter(AbstractChatOpsPort):
    def __init__(self, client: httpx.AsyncClient | None = None):
        self.base_url = settings.MATTERMOST_URL.rstrip("/")
        self.token = settings.MATTERMOST_BOT_TOKEN
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
        self.client = client or httpx.AsyncClient(timeout=10.0)

    async def aclose(self):
        await self.client.aclose()

    async def send_message(self, channel_id: str, text: str) -> dict[str, Any]:
        """Gửi tin nhắn thông thường tới Mattermost."""
        if not self.token:
            logger.warning(
                "MATTERMOST_BOT_TOKEN chưa được cấu hình, bỏ qua send_message."
            )
            return {}

        payload = {"channel_id": channel_id, "message": text}

        try:
            response = await self.client.post(
                f"{self.base_url}/api/v4/posts", headers=self.headers, json=payload
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error("Lỗi khi gửi tin nhắn tới Mattermost: %s", e.response.text)
            raise MattermostAdapterError(f"HTTP Error: {e.response.status_code}") from e
        except Exception as e:
            logger.error("Lỗi kết nối Mattermost: %s", e)
            raise MattermostAdapterError(str(e)) from e

    async def send_interactive_message(
        self,
        channel_id: str,
        text: str,
        action_id: str,
        extra_context: dict[str, Any] | None = None,
    ) -> str:
        """
        Gửi tin nhắn có chứa nút Interactive (Phê duyệt / Từ chối).
        - action_id: ID của lệnh (ví dụ: AI Command ID)
        """
        if not self.token:
            logger.warning(
                "MATTERMOST_BOT_TOKEN chưa được cấu hình, "
                "bỏ qua send_interactive_message."
            )
            return ""

        context = extra_context or {}
        context["action_id"] = action_id

        # Webhook callback URL mà Mattermost sẽ gọi về
        # Giả sử webhook URL nội bộ là domain của Proteus (sẽ cấu hình
        # qua biến môi trường ở thực tế,
        # nhưng ở local/docker thì mattermost có thể gọi tới proteus-backend)
        # Tuy nhiên Mattermost Interactive action sử dụng trường `integration.url`
        # Phải dùng internal URL để Mattermost server gọi sang Backend server
        backend_url = "http://proteus-backend:8000"
        secret = getattr(settings, "MATTERMOST_WEBHOOK_SECRET", "")
        webhook_url = f"{backend_url}/api/v1/webhooks/mattermost/callback"
        if secret:
            webhook_url += f"?token={secret}"

        payload = {
            "channel_id": channel_id,
            "props": {
                "attachments": [
                    {
                        "pretext": "Yêu cầu phê duyệt hành động hệ thống:",
                        "text": text,
                        "actions": [
                            {
                                "id": "approveButton",
                                "name": "Phê duyệt",
                                "integration": {
                                    "url": webhook_url,
                                    "context": {**context, "action": "approve"},
                                },
                            },
                            {
                                "id": "rejectButton",
                                "name": "Từ chối",
                                "style": "danger",
                                "integration": {
                                    "url": webhook_url,
                                    "context": {**context, "action": "reject"},
                                },
                            },
                        ],
                    }
                ]
            },
        }

        try:
            response = await self.client.post(
                f"{self.base_url}/api/v4/posts", headers=self.headers, json=payload
            )
            response.raise_for_status()
            result = response.json()
            logger.info(
                "Mattermost interactive message sent",
                extra={"post_id": result.get("id")},
            )
            return result.get("id", "")
        except httpx.HTTPStatusError as e:
            logger.error("Lỗi khi gửi interactive message: %s", e.response.text)
            raise MattermostAdapterError(f"HTTP Error: {e.response.status_code}") from e
        except Exception as e:
            logger.error("Lỗi kết nối Mattermost: %s", e)
            raise MattermostAdapterError(str(e)) from e

    async def update_message(
        self, post_id: str, message: str, props: dict[str, Any] | None = None
    ) -> None:
        """Chưa implement."""
        raise NotImplementedError("update_message chưa được implement")

    # ─── Team-per-tenant isolation ────────────────────────────
    # Mỗi tenant có 1 Team riêng (tenant_<slug>); user chỉ thấy team mình
    # tham gia. Mọi method dưới raise MattermostAdapterError khi lỗi —
    # caller (onboarding/invite) quyết định best-effort hay fail cứng.

    async def _call(
        self, method: str, path: str, **kwargs: Any
    ) -> httpx.Response:
        """Gọi MM API, map lỗi HTTP thành MattermostAdapterError."""
        if not self.token:
            raise MattermostAdapterError("MATTERMOST_BOT_TOKEN chưa cấu hình.")
        try:
            response = await self.client.request(
                method, f"{self.base_url}{path}", headers=self.headers, **kwargs
            )
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as e:
            logger.error("Mattermost API %s %s: %s", method, path, e.response.text)
            raise MattermostAdapterError(
                f"HTTP Error: {e.response.status_code}"
            ) from e
        except Exception as e:
            logger.error("Lỗi kết nối Mattermost: %s", e)
            raise MattermostAdapterError(str(e)) from e

    async def get_team_by_name(self, name: str) -> dict[str, Any] | None:
        """Lấy team theo name (slug). 404 → None (chưa tồn tại)."""
        try:
            response = await self._call("GET", f"/api/v4/teams/name/{name}")
            return response.json()
        except MattermostAdapterError as e:
            if "404" in str(e):
                return None
            raise

    async def create_team(
        self, name: str, display_name: str, team_type: str = "I"
    ) -> dict[str, Any]:
        """Tạo team mới. type 'I' = invite-only (kín giữa tenant)."""
        response = await self._call(
            "POST",
            "/api/v4/teams",
            json={
                "name": name,
                "display_name": display_name,
                "type": team_type,
            },
        )
        team = response.json()
        logger.info("Đã tạo Mattermost team", extra={"team": name})
        return team

    async def create_channel(
        self,
        team_id: str,
        name: str,
        display_name: str,
        channel_type: str = "O",
    ) -> dict[str, Any]:
        """Tạo channel trong team. Tồn tại rồi (400) → lấy lại theo tên."""
        try:
            response = await self._call(
                "POST",
                "/api/v4/channels",
                json={
                    "team_id": team_id,
                    "name": name,
                    "display_name": display_name,
                    "type": channel_type,
                },
            )
            return response.json()
        except MattermostAdapterError as e:
            if "400" not in str(e):
                raise
            existing = await self._call(
                "GET", f"/api/v4/teams/{team_id}/channels/name/{name}"
            )
            return existing.json()

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        """Tìm MM user theo email. Không thấy → None."""
        response = await self._call(
            "POST", "/api/v4/users/search", json={"term": email, "limit": 5}
        )
        for user in response.json() or []:
            if (user.get("email") or "").lower() == email.lower():
                return user
        return None

    async def create_user(
        self, email: str, username: str, password: str
    ) -> dict[str, Any]:
        """
        Tạo MM user (login chính vẫn qua SSO Keycloak; password random này
        chỉ để thỏa mãn API — user không bao giờ dùng trực tiếp).
        """
        response = await self._call(
            "POST",
            "/api/v4/users",
            json={"email": email, "username": username, "password": password},
        )
        return response.json()

    async def add_user_to_team(self, team_id: str, user_id: str) -> None:
        """Thêm member vào team. Đã là member (400) → bỏ qua."""
        try:
            await self._call(
                "POST",
                f"/api/v4/teams/{team_id}/members",
                json={"team_id": team_id, "user_id": user_id},
            )
        except MattermostAdapterError as e:
            if "400" not in str(e):
                raise
            logger.info(
                "User đã ở trong team", extra={"team_id": team_id, "user": user_id}
            )

    async def ensure_user_in_team_by_email(
        self, team_id: str, email: str, username: str, password: str
    ) -> dict[str, Any]:
        """Đảm bảo MM user tồn tại và nằm trong team (dùng cho invite)."""
        user = await self.get_user_by_email(email)
        if not user:
            user = await self.create_user(email, username, password)
        await self.add_user_to_team(team_id, user["id"])
        return user

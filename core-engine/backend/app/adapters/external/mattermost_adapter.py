# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
from typing import Any

import httpx

from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class MattermostAdapterError(Exception):
    pass


class MattermostAdapter:
    def __init__(self):
        self.base_url = settings.MATTERMOST_URL.rstrip("/")
        self.token = settings.MATTERMOST_BOT_TOKEN
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
        self.client = httpx.AsyncClient(
            base_url=self.base_url, headers=self.headers, timeout=10.0
        )

    async def close(self):
        await self.client.aclose()

    async def resolve_channel_id(self, channel_or_id: str) -> str | None:
        """Resolve a channel name or ID to a valid Mattermost channel ID.
        Caches the result to avoid repeated API calls.
        """
        if not hasattr(self, "_channel_cache"):
            self._channel_cache = {}
        if channel_or_id in self._channel_cache:
            return self._channel_cache[channel_or_id]

        try:
            # 1. Try as channel ID
            res = await self.client.get(f"/api/v4/channels/{channel_or_id}")
            if res.status_code == 200:
                cid = res.json()["id"]
                self._channel_cache[channel_or_id] = cid
                return cid
        except Exception:
            pass

        try:
            # 2. Try as channel name across teams
            teams_res = await self.client.get("/api/v4/users/me/teams")
            if teams_res.status_code == 200:
                for team in teams_res.json():
                    res = await self.client.get(
                        f"/api/v4/teams/{team['id']}/channels/name/{channel_or_id}"
                    )
                    if res.status_code == 200:
                        cid = res.json()["id"]
                        self._channel_cache[channel_or_id] = cid
                        return cid
        except Exception as e:
            logger.error(f"Error resolving channel name {channel_or_id}: {e}")

        return None

    async def send_message(self, channel: str, text: str) -> dict[str, Any]:
        """Gửi tin nhắn thông thường tới Mattermost."""
        if not self.token:
            logger.warning(
                "MATTERMOST_BOT_TOKEN chưa được cấu hình, bỏ qua send_message."
            )
            return {}

        channel_id = await self.resolve_channel_id(channel)
        if not channel_id:
            logger.error(f"Cannot find Mattermost channel: {channel}")
            return {}

        payload = {"channel_id": channel_id, "message": text}

        try:
            response = await self.client.post("/api/v4/posts", json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Lỗi khi gửi tin nhắn tới Mattermost: {e.response.text}")
            raise MattermostAdapterError(
                f"HTTP Error: {e.response.status_code}"
            ) from e
        except Exception as e:
            logger.error(f"Lỗi kết nối Mattermost: {e}")
            raise MattermostAdapterError(str(e)) from e

    async def send_interactive_message(
        self, channel: str, text: str, action_id: str, extra_context: dict = None
    ) -> dict[str, Any]:
        """
        Gửi tin nhắn có chứa nút Interactive (Phê duyệt / Từ chối).
        - action_id: ID của lệnh (ví dụ: AI Command ID)
        """
        if not self.token:
            logger.warning(
                "MATTERMOST_BOT_TOKEN chưa được cấu hình, "
                "bỏ qua send_interactive_message."
            )
            return {}

        context = extra_context or {}
        context["action_id"] = action_id

        # Webhook callback URL mà Mattermost sẽ gọi về
        # Giả sử webhook URL nội bộ là domain của Proteus (sẽ cấu hình qua
        # biến môi trường ở thực tế, nhưng ở local/docker thì mattermost có
        # thể gọi tới proteus-backend).
        # Tuy nhiên Mattermost Interactive action sử dụng trường `integration.url`
        # Ta sẽ dùng URL nội bộ.
        backend_url = "http://proteus-backend:8000"
        webhook_url = f"{backend_url}/api/v1/webhooks/mattermost/callback"

        channel_id = await self.resolve_channel_id(channel)
        if not channel_id:
            logger.error(f"Cannot find Mattermost channel: {channel}")
            return {}

        payload = {
            "channel_id": channel_id,
            "message": text,
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
            response = await self.client.post("/api/v4/posts", json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Lỗi khi gửi interactive message: {e.response.text}")
            raise MattermostAdapterError(
                f"HTTP Error: {e.response.status_code}"
            ) from e
        except Exception as e:
            logger.error(f"Lỗi kết nối Mattermost: {e}")
            raise MattermostAdapterError(str(e)) from e

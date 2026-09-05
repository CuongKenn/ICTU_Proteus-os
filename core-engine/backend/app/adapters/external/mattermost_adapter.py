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
        # Ta sẽ dùng một relative path hoặc absolute URL. Ở đây giả định
        # Mattermost có thể phân giải được URL backend.
        backend_url = getattr(
            settings, "BACKEND_URL", "http://proteus-backend:8000"
        ).rstrip("/")
        webhook_url = f"{backend_url}/api/v1/webhooks/mattermost/callback"

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

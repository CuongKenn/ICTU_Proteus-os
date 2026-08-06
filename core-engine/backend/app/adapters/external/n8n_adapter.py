# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — n8n Workflow Engine Integration
# Secondary Adapter trong Hexagonal Architecture.
# Plugin Manager gọi adapter này để import/activate/delete workflows và trigger webhooks.

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.infrastructure.config import settings

logger = logging.getLogger(__name__)

# Số lần retry khi n8n trả về 5xx
_MAX_RETRIES: int = 3
# Timeout mặc định cho các request tới n8n
_DEFAULT_TIMEOUT: float = 30.0


class N8nAdapterError(Exception):
    """Base exception cho N8nAdapter — bắt ở Use Case layer."""


class N8nWorkflowNotFoundError(N8nAdapterError):
    """Workflow không tồn tại trên n8n."""


class N8nAdapter:
    """
    Secondary Adapter giao tiếp với n8n Workflow Engine.

    Responsibilities:
    - Import workflow JSON vào n8n khi Plugin được cài đặt (Bước 2 Plugin Install)
    - Activate / Deactivate workflow theo lifecycle của Plugin
    - Delete workflow khi Plugin bị gỡ cài đặt (Bước 2 Plugin Uninstall)
    - Trigger webhook endpoint của n8n để khởi động workflow thủ công

    Pattern: Hexagonal Architecture (Outbound / Secondary Adapter)
    Không chứa business logic — chỉ là translation layer giữa domain và n8n HTTP API.
    """

    def __init__(self) -> None:
        self._base_url: str = settings.N8N_URL.rstrip("/")
        self._headers: dict[str, str] = {
            "X-N8N-API-KEY": settings.N8N_API_KEY,
            "Content-Type": "application/json",
        }

    def _build_url(self, path: str) -> str:
        """Tạo URL đầy đủ từ base URL và path tương đối."""
        return f"{self._base_url}/api/v1/{path.lstrip('/')}"

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        *,
        json: dict | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> httpx.Response:
        """
        Gửi HTTP request tới n8n với retry logic cho lỗi 5xx.

        Retry tối đa _MAX_RETRIES lần nếu n8n trả về 500–599.
        Không retry cho lỗi 4xx (client error — không có ích gì khi retry).
        """
        last_exc: Exception | None = None

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(headers=self._headers) as client:
                    response = await client.request(
                        method,
                        url,
                        json=json,
                        timeout=timeout,
                    )

                    # Retry chỉ với 5xx
                    if response.status_code >= 500:
                        logger.warning(
                            "n8n returned 5xx, retrying",
                            extra={
                                "attempt": attempt,
                                "max_retries": _MAX_RETRIES,
                                "status": response.status_code,
                                "url": url,
                            },
                        )
                        last_exc = N8nAdapterError(
                            f"n8n 5xx error: {response.status_code} — attempt {attempt}/{_MAX_RETRIES}"
                        )
                        continue  # next attempt

                    return response

            except httpx.TransportError as exc:
                logger.warning(
                    "n8n connection error, retrying",
                    extra={"attempt": attempt, "error": str(exc)},
                )
                err_msg = f"n8n connection failed: {exc}"
                last_exc = N8nAdapterError(err_msg)
                last_exc.__cause__ = exc

        # Hết retry
        raise last_exc or N8nAdapterError("n8n request failed after all retries")

    async def import_workflow(self, workflow_json: dict[str, Any]) -> str:
        """
        Import một workflow JSON vào n8n.

        Gọi POST /api/v1/workflows để tạo workflow mới.
        Trả về workflow_id (string) để lưu vào DB cho việc uninstall sau này.

        Args:
            workflow_json: Nội dung workflow theo định dạng n8n JSON export.

        Returns:
            workflow_id: ID của workflow vừa tạo trên n8n.

        Raises:
            N8nAdapterError: Nếu n8n trả về lỗi hoặc response không hợp lệ.
        """
        url = self._build_url("workflows")
        logger.info(
            "Importing workflow to n8n",
            extra={"workflow_name": workflow_json.get("name", "unknown")},
        )

        response = await self._request_with_retry("POST", url, json=workflow_json)

        if response.status_code not in (200, 201):
            logger.error(
                "Failed to import workflow",
                extra={"status": response.status_code, "body": response.text[:500]},
            )
            raise N8nAdapterError(
                f"n8n import_workflow failed: HTTP {response.status_code} — {response.text[:200]}"
            )

        data = response.json()
        workflow_id = str(data.get("id", ""))

        if not workflow_id:
            raise N8nAdapterError("n8n import_workflow: response missing 'id' field")

        logger.info(
            "Workflow imported successfully",
            extra={"workflow_id": workflow_id, "name": data.get("name")},
        )
        return workflow_id

    async def activate_workflow(self, workflow_id: str) -> None:
        """
        Kích hoạt (activate) một workflow trên n8n.

        Gọi POST /api/v1/workflows/{id}/activate.
        Workflow phải được activate mới có thể nhận trigger (webhook, cron, v.v.).

        Args:
            workflow_id: ID của workflow cần activate.

        Raises:
            N8nWorkflowNotFoundError: Nếu workflow không tồn tại.
            N8nAdapterError: Nếu n8n trả về lỗi khác.
        """
        url = self._build_url(f"workflows/{workflow_id}/activate")
        logger.info("Activating n8n workflow", extra={"workflow_id": workflow_id})

        response = await self._request_with_retry("POST", url)

        if response.status_code == 404:
            raise N8nWorkflowNotFoundError(f"Workflow '{workflow_id}' not found on n8n")

        if response.status_code not in (200, 201):
            raise N8nAdapterError(
                f"n8n activate_workflow failed: HTTP {response.status_code} — {response.text[:200]}"
            )

        logger.info(
            "Workflow activated successfully", extra={"workflow_id": workflow_id}
        )

    async def deactivate_workflow(self, workflow_id: str) -> None:
        """
        Tắt (deactivate) một workflow trên n8n.

        Dùng khi Plugin bị Disable tạm thời (không xóa workflow).

        Args:
            workflow_id: ID của workflow cần deactivate.

        Raises:
            N8nWorkflowNotFoundError: Nếu workflow không tồn tại.
            N8nAdapterError: Nếu n8n trả về lỗi khác.
        """
        url = self._build_url(f"workflows/{workflow_id}/deactivate")
        logger.info("Deactivating n8n workflow", extra={"workflow_id": workflow_id})

        response = await self._request_with_retry("POST", url)

        if response.status_code == 404:
            raise N8nWorkflowNotFoundError(f"Workflow '{workflow_id}' not found on n8n")

        if response.status_code not in (200, 201):
            raise N8nAdapterError(
                f"n8n deactivate_workflow failed: HTTP {response.status_code}"
            )

        logger.info(
            "Workflow deactivated successfully", extra={"workflow_id": workflow_id}
        )

    async def delete_workflow(self, workflow_id: str) -> None:
        """
        Xóa vĩnh viễn một workflow khỏi n8n.

        Gọi DELETE /api/v1/workflows/{id}.
        Sử dụng trong Plugin Uninstall Use Case (Bước 2 — reverse).

        Args:
            workflow_id: ID của workflow cần xóa.

        Raises:
            N8nWorkflowNotFoundError: Nếu workflow không tồn tại (idempotent OK).
            N8nAdapterError: Nếu n8n trả về lỗi khác.
        """
        url = self._build_url(f"workflows/{workflow_id}")
        logger.info("Deleting n8n workflow", extra={"workflow_id": workflow_id})

        response = await self._request_with_retry("DELETE", url)

        if response.status_code == 404:
            # Idempotent: đã không tồn tại → log warning, không raise
            logger.warning(
                "Workflow not found on n8n during delete (already removed?)",
                extra={"workflow_id": workflow_id},
            )
            return

        if response.status_code not in (200, 204):
            raise N8nAdapterError(
                f"n8n delete_workflow failed: HTTP {response.status_code} — {response.text[:200]}"
            )

        logger.info("Workflow deleted successfully", extra={"workflow_id": workflow_id})

    async def trigger_webhook(
        self,
        webhook_url: str,
        payload: dict[str, Any],
        *,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> dict[str, Any]:
        """
        Kích hoạt một n8n webhook endpoint.

        Dùng bởi AI Orchestrator khi thực thi DSL Command (effect: write/critical)
        sau khi đã được Ban Giám Đốc phê duyệt qua Mattermost.

        Args:
            webhook_url: URL đầy đủ của n8n webhook (lấy từ DSL Command payload).
            payload: JSON body gửi kèm theo webhook.
            timeout: Timeout tính bằng giây (default 30s).

        Returns:
            Response JSON từ n8n workflow.

        Raises:
            N8nAdapterError: Nếu webhook call thất bại.
        """
        logger.info(
            "Triggering n8n webhook",
            extra={"url": webhook_url, "payload_keys": list(payload.keys())},
        )

        # Webhook URL là full URL (không dùng _build_url vì đây là endpoint do n8n sinh ra)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                timeout=timeout,
            )

        if response.status_code not in (200, 201):
            logger.error(
                "n8n webhook trigger failed",
                extra={"status": response.status_code, "url": webhook_url},
            )
            raise N8nAdapterError(
                f"n8n trigger_webhook failed: HTTP {response.status_code} — {response.text[:200]}"
            )

        result = response.json() if response.content else {}
        logger.info(
            "n8n webhook triggered successfully",
            extra={"url": webhook_url, "response_keys": list(result.keys())},
        )
        return result

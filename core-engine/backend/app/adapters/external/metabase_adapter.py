# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Metabase BI Integration
# Secondary Adapter trong Hexagonal Architecture.
# Plugin Manager gọi adapter này để import/delete dashboards và tạo signed embed URLs.

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx
from jose import jwt

from app.core.domain.ports import AbstractAnalyticsPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)

# Số lần retry khi Metabase trả về 5xx
_MAX_RETRIES: int = 3
# Timeout mặc định cho các request tới Metabase
_DEFAULT_TIMEOUT: float = 30.0
# TTL mặc định cho embed URL (giây)
_EMBED_URL_TTL: int = 60


class MetabaseAdapterError(Exception):
    """Base exception cho MetabaseAdapter — bắt ở Use Case layer."""


class MetabaseDashboardNotFoundError(MetabaseAdapterError):
    """Dashboard không tồn tại trên Metabase."""


class MetabaseAdapter(AbstractAnalyticsPort):
    """
    Secondary Adapter giao tiếp với Metabase BI Platform.

    Responsibilities:
    - Import dashboard JSON vào Metabase khi Plugin được cài đặt (Bước 3 Plugin Install)
    - Delete dashboard khi Plugin bị gỡ cài đặt (Bước 4 Plugin Uninstall)
    - Tạo signed embed URL với TTL 60s để nhúng Iframe an toàn
      (không cần Metabase Enterprise plan)

    Pattern: Hexagonal Architecture (Outbound / Secondary Adapter)
    Không chứa business logic — chỉ là translation layer
    giữa domain và Metabase HTTP API.

    Tham khảo: docs/clarification.md §4.2 — Metabase OSS embedding
    """

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._base_url: str = settings.METABASE_SITE_URL.rstrip("/")
        self._embedding_key: str | None = settings.METABASE_EMBEDDING_KEY
        self._headers: dict[str, str] = {
            "Content-Type": "application/json",
        }
        self._session_token: str | None = None
        self._client = client or httpx.AsyncClient(headers=self._headers)

    async def aclose(self) -> None:
        """Đóng httpx client. Nên được gọi khi application shutdown."""
        await self._client.aclose()

    def _build_url(self, path: str) -> str:
        """Tạo URL đầy đủ từ base URL và path tương đối."""
        return f"{self._base_url}/api/{path.lstrip('/')}"

    async def _ensure_session(self) -> str:
        """
        Lấy session token để gọi Metabase Admin API.
        Sử dụng API Key (METABASE_EMBEDDING_KEY) làm session header.
        Metabase OSS hỗ trợ API key authentication.
        """
        if self._session_token is None:
            self._session_token = self._embedding_key
        return self._session_token

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        *,
        json_data: dict[str, Any] | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> httpx.Response:
        """
        Gửi HTTP request tới Metabase với retry logic cho lỗi 5xx.

        Retry tối đa _MAX_RETRIES lần nếu Metabase trả về 500–599.
        Không retry cho lỗi 4xx (client error — không có ích gì khi retry).
        """
        session_token = await self._ensure_session()
        last_exc: Exception | None = None

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                # Gắn API Key (nếu có)
                headers = dict(self._headers)
                if session_token:
                    headers["X-Metabase-Session"] = session_token

                response = await self._client.request(
                    method,
                    url,
                    headers=headers,
                    json=json_data,
                    timeout=timeout,
                    follow_redirects=False,
                )

                # Retry chỉ với 5xx
                if response.status_code >= 500:
                    logger.warning(
                        "Metabase returned 5xx, retrying",
                        extra={
                            "attempt": attempt,
                            "max_retries": _MAX_RETRIES,
                            "status": response.status_code,
                            "url": url,
                        },
                    )
                    last_exc = MetabaseAdapterError(
                        f"Metabase 5xx error: {response.status_code} "
                        f"— attempt {attempt}/{_MAX_RETRIES}"
                    )
                    await asyncio.sleep(2 ** (attempt - 1))
                    continue  # next attempt

                return response

            except httpx.TransportError as exc:
                logger.warning(
                    "Metabase connection error, retrying",
                    extra={"attempt": attempt, "error": str(exc)},
                )
                err_msg = f"Metabase connection failed: {exc}"
                last_exc = MetabaseAdapterError(err_msg)
                last_exc.__cause__ = exc
                await asyncio.sleep(2 ** (attempt - 1))

        # Hết retry
        raise last_exc or MetabaseAdapterError(
            "Metabase request failed after all retries"
        )

    async def create_dashboard(self, config: dict[str, Any]) -> str:
        """
        Import một dashboard JSON vào Metabase.

        Gọi POST /api/dashboard để tạo dashboard mới.
        Trả về dashboard_id (string) để lưu vào DB cho việc uninstall sau này.

        Args:
            config: Nội dung dashboard theo định dạng Metabase JSON export.
                    Bao gồm: name, description, cards, parameters, v.v.

        Returns:
            dashboard_id: ID của dashboard vừa tạo trên Metabase.

        Raises:
            MetabaseAdapterError: Nếu Metabase trả về lỗi hoặc response không hợp lệ.
        """
        url = self._build_url("dashboard")
        logger.info(
            "Creating dashboard on Metabase",
            extra={"dashboard_name": config.get("name", "unknown")},
        )

        response = await self._request_with_retry("POST", url, json_data=config)

        if response.status_code not in (200, 201, 202):
            logger.error(
                "Failed to create Metabase dashboard",
                extra={"status": response.status_code, "body": response.text[:500]},
            )
            raise MetabaseAdapterError(
                f"Metabase create_dashboard failed: HTTP {response.status_code} "
                f"— {response.text[:200]}"
            )

        data = response.json()
        raw_id = data.get("id")
        if raw_id is None or raw_id == "":
            raise MetabaseAdapterError(
                "Metabase create_dashboard: response missing 'id' field"
            )

        dashboard_id = str(raw_id)
        logger.info(
            "Metabase dashboard created",
            extra={"dashboard_id": dashboard_id, "dashboard_name": data.get("name")},
        )
        return dashboard_id

    async def delete_dashboard(self, dashboard_id: str) -> None:
        """
        Xóa vĩnh viễn một dashboard khỏi Metabase.

        Gọi DELETE /api/dashboard/{id}.
        Sử dụng trong Plugin Uninstall Use Case (Bước 4 — reverse).

        Args:
            dashboard_id: ID của dashboard cần xóa.

        Raises:
            MetabaseAdapterError: Nếu Metabase trả về lỗi khác 404.
        """
        url = self._build_url(f"dashboard/{dashboard_id}")
        logger.info("Deleting Metabase dashboard", extra={"dashboard_id": dashboard_id})

        response = await self._request_with_retry("DELETE", url)

        if response.status_code == 404:
            # Idempotent: đã không tồn tại → log warning, không raise
            logger.warning(
                "Dashboard not found on Metabase during delete (already removed?)",
                extra={"dashboard_id": dashboard_id},
            )
            return

        if response.status_code not in (200, 204):
            raise MetabaseAdapterError(
                f"Metabase delete_dashboard failed: HTTP {response.status_code} "
                f"— {response.text[:200]}"
            )

        logger.info(
            "Dashboard deleted successfully", extra={"dashboard_id": dashboard_id}
        )

    def get_embed_url(
        self,
        dashboard_id: str,
        tenant_id: str,
        *,
        ttl: int = _EMBED_URL_TTL,
    ) -> str:
        """
        Tạo signed embed URL cho Metabase dashboard.

        Sử dụng HMAC-SHA256 với METABASE_EMBEDDING_KEY để ký JWT-like token.
        URL có TTL mặc định 60 giây để đảm bảo an toàn khi nhúng Iframe.
        tenant_id được truyền vào làm locked parameter — user không thể thay đổi.

        Metabase OSS hỗ trợ Public Sharing + Signed Embedding mà không cần
        Enterprise plan. Chi tiết: docs/clarification.md §4.2

        Args:
            dashboard_id: ID dashboard trên Metabase.
            tenant_id: UUID Tenant — locked parameter, ép filter theo Tenant.
            ttl: Thời gian sống của URL tính bằng giây (mặc định 60s).

        Returns:
            Signed URL dạng:
            {METABASE_SITE_URL}/embed/dashboard/{token}#bordered=true&titled=true
        """
        if not self._embedding_key:
            raise MetabaseAdapterError("METABASE_EMBEDDING_KEY is not configured.")

        # Tạo payload JWT-like theo chuẩn Metabase embedding
        # Metabase OSS sử dụng JWT token signed với EMBEDDING_KEY
        payload = {
            "resource": {"dashboard": int(dashboard_id)},
            "params": {"tenant_id": tenant_id},
            "exp": int(time.time()) + ttl,
        }

        # Tạo JWT token chuẩn hỗ trợ Metabase Signed Embedding
        token = jwt.encode(
            payload,
            self._embedding_key,
            algorithm="HS256",
        )

        embed_url = (
            f"{self._base_url}/embed/dashboard/{token}" "#bordered=true&titled=true"
        )

        logger.debug(
            "Generated Metabase embed URL",
            extra={
                "dashboard_id": dashboard_id,
                "tenant_id": tenant_id,
                "ttl": ttl,
            },
        )
        return embed_url

    async def import_dashboard(self, dashboard_json: dict[str, Any], tenant_id: str, dashboard_name: str) -> str:
        """Alias cho create_dashboard để tuân thủ interface AbstractAnalyticsPort."""
        return await self.create_dashboard(dashboard_json)

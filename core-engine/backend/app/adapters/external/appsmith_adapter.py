# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Appsmith Low-code UI Integration
# Secondary Adapter trong Hexagonal Architecture.
# Plugin Manager gọi adapter này để import/delete UI Apps và kiểm tra PATH_CONFLICT.

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.core.domain.exceptions import PathConflictError
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)

# Số lần retry khi Appsmith trả về 5xx
_MAX_RETRIES: int = 3
# Timeout mặc định cho các request tới Appsmith
_DEFAULT_TIMEOUT: float = 30.0

# Các path hệ thống bị cấm — Plugin không được dùng
_SYSTEM_PATHS: frozenset[str] = frozenset(
    {
        "/auth",
        "/api",
        "/chat",
        "/files",
        "/wiki",
        "/workflow",
        "/analytics",
        "/monitoring",
    }
)


class AppsmithAdapterError(Exception):
    """Base exception cho AppsmithAdapter — bắt ở Use Case layer."""


class AppsmithAppNotFoundError(AppsmithAdapterError):
    """UI App không tồn tại trên Appsmith."""


class AppsmithAdapter:
    """
    Secondary Adapter giao tiếp với Appsmith Low-code Platform.

    Responsibilities:
    - Import UI App JSON vào Appsmith khi Plugin được cài đặt (Bước 4 Plugin Install)
    - Delete UI App khi Plugin bị gỡ cài đặt (Bước 3 Plugin Uninstall)
    - Kiểm tra PATH_CONFLICT trước khi cài đặt — đảm bảo path không trùng

    Pattern: Hexagonal Architecture (Outbound / Secondary Adapter)
    Không chứa business logic — chỉ là translation layer giữa domain và Appsmith HTTP API.

    Tham khảo:
    - docs/plugin-manifest-spec.md §3.5 — ui_apps path rules
    - docs/plugin-manifest-spec.md §4 Bước 4 — Nạp ui_apps vào Appsmith
    """

    def __init__(self) -> None:
        self._base_url: str = settings.APPSMITH_URL.rstrip("/")
        self._headers: dict[str, str] = {
            "Authorization": f"Bearer {settings.APPSMITH_API_KEY}",
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(headers=self._headers)

    async def aclose(self) -> None:
        """Đóng httpx client. Nên được gọi khi application shutdown."""
        await self._client.aclose()

    def _build_url(self, path: str) -> str:
        """Tạo URL đầy đủ từ base URL và path tương đối."""
        return f"{self._base_url}/api/v1/{path.lstrip('/')}"

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        *,
        json_data: dict[str, Any] | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> httpx.Response:
        """
        Gửi HTTP request tới Appsmith với retry logic cho lỗi 5xx.

        Retry tối đa _MAX_RETRIES lần nếu Appsmith trả về 500–599.
        Không retry cho lỗi 4xx (client error — không có ích gì khi retry).
        """
        last_exc: Exception | None = None

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                response = await self._client.request(
                    method,
                    url,
                    json=json_data,
                    timeout=timeout,
                    follow_redirects=False,
                )

                # Retry chỉ với 5xx
                if response.status_code >= 500:
                    logger.warning(
                        "Appsmith returned 5xx, retrying",
                        extra={
                            "attempt": attempt,
                            "max_retries": _MAX_RETRIES,
                            "status": response.status_code,
                            "url": url,
                        },
                    )
                    last_exc = AppsmithAdapterError(
                        f"Appsmith 5xx error: {response.status_code} "
                        f"— attempt {attempt}/{_MAX_RETRIES}"
                    )
                    await asyncio.sleep(2 ** (attempt - 1))
                    continue  # next attempt

                return response

            except httpx.TransportError as exc:
                logger.warning(
                    "Appsmith connection error, retrying",
                    extra={"attempt": attempt, "error": str(exc)},
                )
                err_msg = f"Appsmith connection failed: {exc}"
                last_exc = AppsmithAdapterError(err_msg)
                last_exc.__cause__ = exc
                await asyncio.sleep(2 ** (attempt - 1))

        # Hết retry
        raise last_exc or AppsmithAdapterError(
            "Appsmith request failed after all retries"
        )

    async def import_app(self, json_data: dict[str, Any]) -> str:
        """
        Import một UI App JSON vào Appsmith.

        Gọi POST /api/v1/applications/import để tạo ứng dụng mới.
        Trả về app_id (string) để lưu vào DB cho việc uninstall sau này.

        Args:
            json_data: Nội dung App theo định dạng Appsmith JSON export.

        Returns:
            app_id: ID của UI App vừa tạo trên Appsmith.

        Raises:
            AppsmithAdapterError: Nếu Appsmith trả về lỗi hoặc response không hợp lệ.
        """
        url = self._build_url("applications/import")
        logger.info(
            "Importing UI App to Appsmith",
            extra={"app_name": json_data.get("name", "unknown")},
        )

        response = await self._request_with_retry("POST", url, json_data=json_data)

        if response.status_code not in (200, 201):
            logger.error(
                "Failed to import Appsmith app",
                extra={"status": response.status_code, "body": response.text[:500]},
            )
            raise AppsmithAdapterError(
                f"Appsmith import_app failed: HTTP {response.status_code} "
                f"— {response.text[:200]}"
            )

        data = response.json()

        # Appsmith trả về response trong trường "data" hoặc trực tiếp
        app_data = data.get("data", data)
        raw_id = app_data.get("id") or app_data.get("applicationId")
        if raw_id is None or raw_id == "":
            raise AppsmithAdapterError(
                "Appsmith import_app: response missing 'id' field"
            )

        app_id = str(raw_id)
        logger.info(
            "UI App imported successfully",
            extra={"app_id": app_id, "app_name": app_data.get("name")},
        )
        return app_id

    async def delete_app(self, app_id: str) -> None:
        """
        Xóa vĩnh viễn một UI App khỏi Appsmith.

        Gọi DELETE /api/v1/applications/{id}.
        Sử dụng trong Plugin Uninstall Use Case (Bước 3 — reverse).

        Args:
            app_id: ID của UI App cần xóa.

        Raises:
            AppsmithAdapterError: Nếu Appsmith trả về lỗi khác 404.
        """
        url = self._build_url(f"applications/{app_id}")
        logger.info("Deleting Appsmith app", extra={"app_id": app_id})

        response = await self._request_with_retry("DELETE", url)

        if response.status_code == 404:
            # Idempotent: đã không tồn tại → log warning, không raise
            logger.warning(
                "App not found on Appsmith during delete (already removed?)",
                extra={"app_id": app_id},
            )
            return

        if response.status_code not in (200, 204):
            raise AppsmithAdapterError(
                f"Appsmith delete_app failed: HTTP {response.status_code} "
                f"— {response.text[:200]}"
            )

        logger.info("App deleted successfully", extra={"app_id": app_id})

    async def check_path_conflict(
        self,
        path: str,
        tenant_id: str,
    ) -> bool:
        """
        Kiểm tra xem path của UI App đã bị chiếm bởi Plugin khác chưa.

        Quy tắc (theo plugin-manifest-spec.md §3.5):
        - Path phải bắt đầu bằng /apps/
        - Không được trùng với path hệ thống: /auth, /api, /chat, ...
        - Phải là duy nhất trong toàn bộ Tenant

        Args:
            path: Đường dẫn UI App (VD: "/apps/hr").
            tenant_id: UUID Tenant.

        Returns:
            True nếu path bị xung đột (đã có app khác dùng).
            False nếu path còn trống.

        Raises:
            PathConflictError: Nếu path trùng với path hệ thống bị cấm.
            AppsmithAdapterError: Nếu không thể kiểm tra (lỗi kết nối).
        """
        # Kiểm tra path hệ thống bị cấm
        normalized_path = path.rstrip("/").lower()
        for system_path in _SYSTEM_PATHS:
            if normalized_path == system_path or normalized_path.startswith(
                system_path + "/"
            ):
                raise PathConflictError(
                    f"Path '{path}' conflicts with system path '{system_path}'. "
                    f"Plugin UI Apps must use paths under /apps/"
                )

        # Kiểm tra prefix bắt buộc
        if not normalized_path.startswith("/apps/"):
            raise PathConflictError(
                f"Path '{path}' must start with '/apps/' "
                f"(theo plugin-manifest-spec.md §3.5)"
            )

        # Gọi Appsmith API để kiểm tra path conflict trong Tenant
        # Liệt kê tất cả apps của workspace/tenant rồi so sánh path
        url = self._build_url("applications")
        logger.debug(
            "Checking path conflict on Appsmith",
            extra={"path": path, "tenant_id": tenant_id},
        )

        try:
            response = await self._request_with_retry("GET", url)

            if response.status_code != 200:
                logger.warning(
                    "Cannot fetch Appsmith apps for conflict check",
                    extra={"status": response.status_code},
                )
                # Không block install khi không thể kiểm tra
                return False

            data = response.json()
            apps = data.get("data", data) if isinstance(data, dict) else data

            if isinstance(apps, list):
                for app in apps:
                    app_slug = app.get("slug", "")
                    app_path = f"/apps/{app_slug}" if app_slug else ""
                    if app_path.lower() == normalized_path:
                        logger.warning(
                            "Path conflict detected",
                            extra={
                                "path": path,
                                "existing_app": app.get("name"),
                                "tenant_id": tenant_id,
                            },
                        )
                        return True

        except AppsmithAdapterError:
            logger.warning(
                "Appsmith unavailable for path conflict check, proceeding",
                extra={"path": path},
            )
            return False

        logger.debug("No path conflict found", extra={"path": path})
        return False

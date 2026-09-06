# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Redis Event Bus Publisher
# Secondary Adapter trong Hexagonal Architecture.
# Phát sự kiện qua Redis Pub/Sub khi Plugin lifecycle thay đổi
# (Install, Uninstall, Enable, Disable).
#
# Cấu trúc Event chuẩn: docs/plugin-manifest-spec.md §3.7
# Wrapper tự động inject: docs/clarification.md §6.4

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime
from typing import Any, TypeVar

import redis.asyncio as aioredis

from app.core.domain.ports import AbstractEventBusPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)

# Redis channel/stream prefix cho Plugin events
_CHANNEL_PREFIX: str = "proteus:events"
_MAX_RETRIES: int = 3

T = TypeVar("T")


class EventBusPublishError(Exception):
    """Lỗi khi publish event lên Redis — bắt ở Use Case layer."""


class RedisEventBusPublisher(AbstractEventBusPort):
    """
    Secondary Adapter phát sự kiện qua Redis Pub/Sub.

    Responsibilities:
    - Publish lifecycle events khi Plugin Install/Uninstall/Enable/Disable
    - Publish domain events từ Plugin (VD: hr.employee.created)
    - Tự động inject wrapper chuẩn (event_id, tenant_id, plugin_source, created_at)
    - Plugin chỉ cần cung cấp event_type và payload

    Pattern: Hexagonal Architecture (Outbound / Secondary Adapter)
    Không chứa business logic — fire-and-forget publish.

    Cấu trúc Event đầy đủ khi phát lên Redis:
    {
        "event_id": "uuid-v4",              ← Tự động inject
        "event_type": "hr.employee.created", ← Truyền vào
        "tenant_id": "uuid-truong-a",        ← Tự động inject
        "plugin_source": "hr-module",        ← Tự động inject
        "created_at": "2026-08-06T10:00:00Z",← Tự động inject
        "payload": { ... }                    ← Truyền vào
    }
    """

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    async def _get_connection(self) -> aioredis.Redis:
        """
        Lazy-init Redis connection.
        Dùng connection pool để tối ưu hiệu năng.
        """
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                max_connections=10,
            )
            logger.info(
                "Redis Event Bus connected",
                extra={"url": settings.REDIS_URL.split("@")[-1]},  # hide password
            )
        return self._redis

    async def aclose(self) -> None:
        """Đóng Redis connection. Nên được gọi khi application shutdown."""
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None
            logger.info("Redis Event Bus connection closed")

    def _build_channel(self, event_type: str) -> str:
        """
        Tạo Redis channel name từ event_type.

        Convention: proteus:events:{event_type}
        VD: proteus:events:hr.employee.created
        """
        return f"{_CHANNEL_PREFIX}:{event_type}"

    def _build_event_envelope(
        self,
        event_type: str,
        tenant_id: str,
        plugin_source: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Tạo event envelope chuẩn theo docs/clarification.md §6.4.

        Plugin chỉ cung cấp event_type và payload.
        Wrapper (event_id, tenant_id, plugin_source, created_at) được inject tự động.
        """
        return {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "tenant_id": tenant_id,
            "plugin_source": plugin_source,
            "created_at": datetime.now(UTC).isoformat(),
            "payload": payload,
        }

    async def _retry(
        self,
        operation: Callable[[], Coroutine[Any, Any, T]],
        error_msg: str,
    ) -> T:
        """
        Helper function: Retry operation with exponential backoff.
        """
        last_exc: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                return await operation()
            except Exception as exc:
                last_exc = exc
                if attempt < _MAX_RETRIES:
                    sleep_time = 0.5 * (2 ** (attempt - 1))
                    logger.warning(
                        "%s (attempt %d/%d). Retrying in %.1fs...",
                        error_msg,
                        attempt,
                        _MAX_RETRIES,
                        sleep_time,
                    )
                    await asyncio.sleep(sleep_time)

        # Hết retry
        logger.error(
            "%s failed after %d attempts: %s", error_msg, _MAX_RETRIES, last_exc
        )
        raise EventBusPublishError(f"{error_msg} - {last_exc}") from last_exc

    async def publish(
        self,
        event_type: str,
        tenant_id: str,
        plugin_source: str,
        payload: dict[str, Any],
    ) -> None:
        """
        Publish một event lên Redis Pub/Sub.

        Fire-and-forget: nếu không có subscriber nào đang lắng nghe,
        event sẽ bị mất (Pub/Sub không có persistence).
        Đây là thiết kế có chủ đích — dùng cho real-time notifications.

        Args:
            event_type: Loại event theo chuẩn {plugin}.{resource}.{past_tense}
                        VD: "hr.employee.created", "plugin.installed", "plugin.disabled"
            tenant_id: UUID Tenant phát event.
            plugin_source: Code name của Plugin phát event (VD: "hr-module").
            payload: Dữ liệu event (phần bên trong trường payload).

        Raises:
            EventBusPublishError: Nếu không thể publish (Redis down).
        """
        channel = self._build_channel(event_type)
        envelope = self._build_event_envelope(
            event_type=event_type,
            tenant_id=tenant_id,
            plugin_source=plugin_source,
            payload=payload,
        )
        message = json.dumps(envelope, ensure_ascii=False)

        async def _do_publish() -> int:
            conn = await self._get_connection()
            return await conn.publish(channel, message)

        try:
            subscribers_count = await self._retry(
                _do_publish,
                f"Redis Pub/Sub publish failed for event '{event_type}'",
            )
            logger.info(
                "Event published to Redis Pub/Sub",
                extra={
                    "event_type": event_type,
                    "channel": channel,
                    "tenant_id": tenant_id,
                    "plugin_source": plugin_source,
                    "subscribers": subscribers_count,
                    "event_id": envelope["event_id"],
                },
            )
        except EventBusPublishError as e:
            # DLQ (Log-based) cho Pub/Sub
            logger.error(
                "[DLQ] Failed to publish real-time event to Pub/Sub",
                extra={
                    "event_type": event_type,
                    "tenant_id": tenant_id,
                    "envelope": envelope,
                    "error": str(e),
                },
            )
            raise e

    async def publish_critical(
        self,
        event_type: str,
        tenant_id: str,
        plugin_source: str,
        payload: dict[str, Any],
    ) -> None:
        """
        Publish một critical event lên Redis Streams (có persistence).

        Args:
            event_type: Loại event
            tenant_id: UUID Tenant
            plugin_source: Nguồn phát sinh
            payload: Dữ liệu
        """
        stream_name = self._build_channel(event_type)
        envelope = self._build_event_envelope(
            event_type=event_type,
            tenant_id=tenant_id,
            plugin_source=plugin_source,
            payload=payload,
        )
        message_dict = {"data": json.dumps(envelope, ensure_ascii=False)}

        async def _do_xadd() -> str:
            conn = await self._get_connection()
            return await conn.xadd(stream_name, message_dict)  # type: ignore

        try:
            message_id = await self._retry(
                _do_xadd,
                f"Redis Streams xadd failed for event '{event_type}'",
            )
            logger.info(
                "Critical Event published to Redis Stream",
                extra={
                    "event_type": event_type,
                    "stream": stream_name,
                    "tenant_id": tenant_id,
                    "plugin_source": plugin_source,
                    "message_id": message_id,
                    "event_id": envelope["event_id"],
                },
            )
        except EventBusPublishError as e:
            # DLQ (Log-based) cho Redis Streams
            logger.error(
                "[DLQ] Failed to publish critical event to Redis Stream",
                extra={
                    "event_type": event_type,
                    "tenant_id": tenant_id,
                    "envelope": envelope,
                    "error": str(e),
                },
            )
            raise e

    async def publish_plugin_lifecycle(
        self,
        action: str,
        tenant_id: str,
        plugin_name: str,
        plugin_version: str,
        *,
        extra_data: dict[str, Any] | None = None,
    ) -> None:
        """
        Convenience method: Publish plugin lifecycle event.

        Dùng cho: plugin.installed, plugin.uninstalled, plugin.enabled,
                  plugin.disabled, plugin.upgraded, plugin.failed

        Args:
            action: Lifecycle action (installed, uninstalled, enabled, disabled, upgraded, failed).
            tenant_id: UUID Tenant.
            plugin_name: Code name plugin (VD: "hr-module").
            plugin_version: Version hiện tại.
            extra_data: Dữ liệu bổ sung (VD: error_log khi failed).
        """
        event_type = f"plugin.{action}"
        payload: dict[str, Any] = {
            "plugin_name": plugin_name,
            "plugin_version": plugin_version,
        }
        if extra_data:
            payload.update(extra_data)

        await self.publish_critical(
            event_type=event_type,
            tenant_id=tenant_id,
            plugin_source=plugin_name,
            payload=payload,
        )

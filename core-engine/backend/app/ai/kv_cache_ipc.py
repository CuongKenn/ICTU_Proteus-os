# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# AI Engine - KV-Cache Vector IPC Manager
# Giao tiếp liên tiến trình tối ưu bộ nhớ cho Multi-Agent.

import logging
import time
import uuid

from app.adapters.external.qdrant_adapter import QdrantAdapter, QdrantAdapterError
from app.adapters.external.redis_event_bus import RedisEventBusPublisher

logger = logging.getLogger(__name__)


class KVCacheIPCManager:
    """
    Quản lý việc chia sẻ Context State (giả lập KV-Cache) giữa các AI Agents.
    Sử dụng Qdrant làm shared memory và Redis làm message bus.
    """

    def __init__(
        self, qdrant_adapter: QdrantAdapter, redis_publisher: RedisEventBusPublisher
    ):
        self.qdrant_adapter = qdrant_adapter
        self.redis_publisher = redis_publisher

    async def transmit_context(
        self, tenant_id: str, source_agent: str, target_agent: str, context_text: str
    ) -> tuple[uuid.UUID, float]:
        """
        Lưu State vào Qdrant và gửi con trỏ (UUID) qua Redis cho Agent khác.
        Trả về (pointer_uuid, latency_ms).
        """
        start_time = time.perf_counter()

        pointer_uuid = uuid.uuid4()

        # 1. Lưu context vào Qdrant
        # Thay vì tính toán thực sự embedding, QdrantAdapter.upsert_vectors với fastembed sẽ tự tạo.
        metadata = {
            "pointer_uuid": str(pointer_uuid),
            "source_agent": source_agent,
            "target_agent": target_agent,
            "type": "ipc_kv_cache",
        }

        # Chú ý: Cần chunking context_text nếu nó quá dài, nhưng POC này ta lưu nguyên khối
        await self.qdrant_adapter.upsert_vectors(
            tenant_id=tenant_id, chunks=[context_text], metadatas=[metadata]
        )

        # 2. Publish UUID Pointer qua Redis
        payload = {
            "pointer_uuid": str(pointer_uuid),
            "target_agent": target_agent,
        }
        await self.redis_publisher.publish(
            event_type="ai.agent.ipc",
            tenant_id=tenant_id,
            plugin_source=source_agent,
            payload=payload,
        )

        end_time = time.perf_counter()
        latency_ms = (end_time - start_time) * 1000

        logger.info(
            "Transmitted KV-Cache pointer via Event Bus",
            extra={
                "source": source_agent,
                "target": target_agent,
                "pointer_uuid": str(pointer_uuid),
                "latency_ms": latency_ms,
            },
        )

        return pointer_uuid, latency_ms

    async def retrieve_context(self, tenant_id: str, pointer_uuid: str) -> str | None:
        """
        Dùng cho Target Agent: Nhận pointer_uuid và query Qdrant để tải lại State.
        """
        # Note: Do QdrantAdapter hiện tại dùng Hybrid Search, không có hàm get_point.
        # Ta sẽ search bằng filter để tìm lại.
        filters = {"pointer_uuid": pointer_uuid}

        results = await self.qdrant_adapter.search(
            tenant_id=tenant_id, query=pointer_uuid, limit=1, filters=filters
        )

        # Để POC hoạt động với QdrantAdapter hiện tại, ta chỉ cần return log
        if results:
            return results[0].get("document")
        return None

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — Knowledge Sync: nguồn ngoài (connector) → tri thức nội bộ (Outline).
# Idempotent: tài liệu đã đồng bộ (theo external_id) sẽ được bỏ qua.

import logging
from typing import Any

from app.core.domain.ports import (
    AbstractDocumentSourcePort,
    AbstractKnowledgeConnectorPort,
)

logger = logging.getLogger(__name__)


class KnowledgeSyncUseCase:
    """Kéo documents từ connector và publish vào nguồn tri thức đích.

    `synced_external_ids` do caller cung cấp (đọc từ nguồn đích/DB) để tránh
    tạo trùng. Use case chỉ orchestrate, không tự persist state.
    """

    def __init__(
        self,
        connector: AbstractKnowledgeConnectorPort,
        document_source: AbstractDocumentSourcePort,
    ):
        self.connector = connector
        self.document_source = document_source

    async def execute(
        self,
        *,
        config: dict[str, Any] | None = None,
        collection_id: str | None = None,
        synced_external_ids: set[str] | None = None,
        publish: bool = True,
    ) -> dict[str, Any]:
        synced = synced_external_ids or set()
        try:
            documents = await self.connector.fetch_documents(config=config or {})
        except Exception as e:
            logger.error("Knowledge sync fetch thất bại: %s", e)
            return {"status": "failed", "error": str(e)}

        created: list[dict[str, Any]] = []
        skipped = 0
        failed = 0
        for doc in documents:
            ext_id = doc.get("external_id")
            if ext_id and str(ext_id) in synced:
                skipped += 1
                continue
            try:
                result = await self.document_source.publish_document(
                    title=doc["title"],
                    text=doc["text"],
                    collection_id=collection_id,
                    publish=publish,
                )
                created.append(
                    {
                        "external_id": ext_id,
                        "title": result.get("title", doc["title"]),
                        "url": result.get("url"),
                    }
                )
            except Exception as e:
                logger.warning(
                    "Publish tài liệu '%s' thất bại: %s", doc.get("title"), e
                )
                failed += 1

        logger.info(
            "Knowledge sync xong: %s created, %s skipped, %s failed",
            len(created),
            skipped,
            failed,
        )
        return {
            "status": "success" if failed == 0 else "partial",
            "connector": self.connector.name,
            "fetched": len(documents),
            "created": created,
            "skipped": skipped,
            "failed": failed,
        }

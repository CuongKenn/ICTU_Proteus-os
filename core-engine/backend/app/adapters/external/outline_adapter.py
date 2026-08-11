# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
from typing import Any

import httpx

from app.core.domain.ports import AbstractDocumentSourcePort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class OutlineAdapterError(Exception):
    pass


class OutlineAdapter(AbstractDocumentSourcePort):
    """
    Adapter để tương tác với Outline API.
    Sử dụng để lấy danh sách tài liệu cho RAG Ingestion Pipeline.
    """

    def __init__(self):
        self.base_url = settings.OUTLINE_URL.rstrip("/")
        self.api_key = settings.OUTLINE_API_KEY
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def list_documents(
        self, collection_id: str | None = None, offset: int = 0, limit: int = 100
    ) -> list[dict[str, Any]]:
        """
        Lấy danh sách documents từ Outline.
        """
        if not self.api_key:
            logger.warning("OUTLINE_API_KEY is not set. Skipping document fetch.")
            return []

        url = f"{self.base_url}/api/documents.list"
        payload = {"offset": offset, "limit": limit}
        if collection_id:
            payload["collectionId"] = collection_id

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url, headers=self.headers, json=payload, timeout=10.0
                )
                response.raise_for_status()
                data = response.json().get("data", [])
                for doc in data:
                    url_id = doc.get("urlId", "")
                    doc["source_url"] = (
                        f"{self.base_url}/doc/{url_id}" if url_id else ""
                    )
                return data
            except httpx.HTTPError as e:
                logger.error(f"Outline API error: {e}")
                raise OutlineAdapterError(f"Failed to fetch documents: {str(e)}")

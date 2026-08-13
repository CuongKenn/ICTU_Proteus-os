# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue

from app.core.domain.ports import AbstractVectorDBPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class QdrantAdapterError(Exception):
    pass


class QdrantAdapter(AbstractVectorDBPort):
    """
    Adapter cho Qdrant Vector Database sử dụng tính năng Hybrid Search (Dense + BM25)
    thông qua thư viện qdrant-client với fastembed.
    Tham chiếu: ADR-002
    """

    def __init__(self):
        # Khởi tạo AsyncQdrantClient
        self.client = AsyncQdrantClient(url=settings.QDRANT_URL)
        # Sử dụng model hỗ trợ tiếng Việt nếu có thể, hoặc model multilingual.
        # fastembed hỗ trợ BAAI/bge-m3 hoặc intfloat/multilingual-e5-small cho đa ngôn ngữ.
        self.dense_model = "intfloat/multilingual-e5-small"
        self.sparse_model = "Qdrant/bm25"
        self.collection_name = "knowledge_base"
        self._collection_ensured = False

        # Cấu hình embedding models
        self.client.set_model(self.dense_model)
        self.client.set_sparse_model(self.sparse_model)

    async def _ensure_collection_exists(self):
        """Khởi tạo collection nếu chưa tồn tại"""
        if getattr(self, "_collection_ensured", False):
            return
        if not await self.client.collection_exists(self.collection_name):
            logger.info("Creating Qdrant collection: %s", self.collection_name)
            # recreate_collection sẽ tạo collection với cấu hình embedding hiện tại
            # từ fastembed model đã set.
            await self.client.recreate_collection(
                collection_name=self.collection_name,
                vectors_config=self.client.get_fastembed_vector_params(),
                sparse_vectors_config=self.client.get_fastembed_sparse_vector_params(),
            )
        self._collection_ensured = True

    async def upsert_vectors(
        self, tenant_id: str, chunks: list[str], metadatas: list[dict[str, Any]]
    ) -> bool:
        """
        Lưu embeddings (Dense + Sparse) cùng với metadata `tenant_id`.
        """
        try:
            await self._ensure_collection_exists()

            # Gắn tenant_id vào mỗi metadata để đảm bảo data isolation
            for meta in metadatas:
                meta["tenant_id"] = tenant_id

            # fastembed client tự động sinh text embeddings và sparse vectors
            # uuid generation cho id nếu cần, nhưng .add() có thể tự sinh id hoặc ta truyền metadata.
            await self.client.add(
                collection_name=self.collection_name,
                documents=chunks,
                metadata=metadatas,
            )
            return True
        except Exception as e:
            logger.error("Error upserting vectors to Qdrant: %s", e)
            raise QdrantAdapterError(f"Upsert failed: {str(e)}")

    async def search(
        self,
        tenant_id: str,
        query: str,
        limit: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Hybrid Search kết hợp Dense và BM25, filter theo tenant_id (Data Isolation).
        """
        try:
            await self._ensure_collection_exists()

            # Khởi tạo filter để chỉ search trong dữ liệu của tenant hiện tại
            must_conditions = [
                FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))
            ]

            if filters:
                for k, v in filters.items():
                    must_conditions.append(
                        FieldCondition(key=k, match=MatchValue(value=v))
                    )

            tenant_filter = Filter(must=must_conditions)

            # query method của fastembed client hỗ trợ query_text và tự động tính hybrid RRF
            results = await self.client.query(
                collection_name=self.collection_name,
                query_text=query,
                query_filter=tenant_filter,
                limit=limit,
            )

            # Format kết quả
            formatted_results = []
            for hit in results:
                formatted_results.append(
                    {
                        "id": hit.id,
                        "score": hit.score,
                        "document": hit.document,
                        "metadata": hit.metadata,
                    }
                )

            return formatted_results
        except Exception as e:
            logger.error("Error executing hybrid search in Qdrant: %s", e)
            raise QdrantAdapterError(f"Search failed: {str(e)}")

    async def delete_by_tenant(self, tenant_id: str) -> bool:
        """
        Xóa toàn bộ dữ liệu của một tenant khỏi vector DB.
        """
        try:
            await self._ensure_collection_exists()

            tenant_filter = Filter(
                must=[
                    FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))
                ]
            )

            await self.client.delete(
                collection_name=self.collection_name, points_selector=tenant_filter
            )
            return True
        except Exception as e:
            logger.error("Error deleting tenant data from Qdrant: %s", e)
            raise QdrantAdapterError(f"Delete failed: {str(e)}")

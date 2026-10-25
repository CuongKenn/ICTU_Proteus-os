# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import asyncio
import logging
import threading
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue

from app.core.domain.ports import AbstractVectorDBPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)

# M14: cache TextEmbedding theo model (singleton) — tránh load lại model
# nặng mỗi query. Khóa thread-safe cho tạo model sync trong to_thread.
_EMBEDDER_CACHE: dict[str, Any] = {}
_EMBEDDER_LOCK = threading.Lock()


class QdrantAdapterError(Exception):
    pass


class QdrantAdapter(AbstractVectorDBPort):
    """
    Adapter cho Qdrant Vector Database sử dụng tính năng Hybrid Search (Dense + BM25)
    thông qua thư viện qdrant-client với fastembed.
    Tham chiếu: ADR-002
    """

    def __init__(self, qdrant_client: AsyncQdrantClient | None = None):
        # Khởi tạo AsyncQdrantClient hoặc sử dụng instance dùng chung.
        # Embedding models được cấu hình LAZY ở lần dùng đầu tiên: __init__
        # tuyệt đối không raise để 1 RAG hỏng không kéo sập cả /ai/command.
        self.client = qdrant_client or AsyncQdrantClient(url=settings.QDRANT_URL)
        self.dense_model = settings.QDRANT_DENSE_MODEL
        self.sparse_model = "Qdrant/bm25"
        self.collection_name = "knowledge_base"
        self._collection_ensured = False
        self._models_ensured = False
        self._hybrid = False
        self._embedder = None
        self._vector_name: str | None = None
        self._vector_name_resolved = False

    async def aclose(self) -> None:
        """Đóng kết nối Qdrant client."""
        await self.client.close()

    def _ensure_models(self) -> None:
        """Cấu hình embedding models (chạy 1 lần, lazy).

        Dense là bắt buộc. Sparse (BM25/SPLADE) là tùy chọn: môi trường
        thiếu thì fallback dense-only thay vì sập cả RAG.
        """
        if self._models_ensured:
            return
        try:
            self.client.set_model(self.dense_model)
        except Exception as e:
            raise QdrantAdapterError(
                f"Embedding model '{self.dense_model}' không khả dụng: {e}"
            ) from e
        self._hybrid = False
        try:
            self.client.set_sparse_model(self.sparse_model)
            self._hybrid = True
        except Exception as e:
            logger.warning(
                "Sparse model '%s' không khả dụng, dùng dense-only: %s",
                self.sparse_model,
                e,
            )
        self._models_ensured = True

    def _get_embedder_sync(self) -> Any:
        """Lấy (hoặc tạo) TextEmbedding singleton cho dense_model — chạy sync."""
        cached = _EMBEDDER_CACHE.get(self.dense_model)
        if cached is not None:
            return cached
        if self._embedder is not None:
            _EMBEDDER_CACHE[self.dense_model] = self._embedder
            return self._embedder
        from fastembed import TextEmbedding

        with _EMBEDDER_LOCK:
            # Double-check sau khi giữ lock.
            cached = _EMBEDDER_CACHE.get(self.dense_model)
            if cached is not None:
                self._embedder = cached
                return cached
            embedder = TextEmbedding(self.dense_model)
            _EMBEDDER_CACHE[self.dense_model] = embedder
            self._embedder = embedder
            return embedder

    async def _dense_vector(self, text: str) -> list[float]:
        """Embed 1 câu query bằng dense model (dùng khi dense-only).

        M14: fastembed TextEmbedding.embed là sync/blocking → offload sang
        asyncio.to_thread để không chặn event loop; model được cache singleton.
        """
        embedder = await asyncio.to_thread(self._get_embedder_sync)

        def _embed_once() -> Any:
            return next(iter(embedder.embed([text])))

        vec = await asyncio.to_thread(_embed_once)
        return vec.tolist() if hasattr(vec, "tolist") else list(vec)

    async def _resolve_vector_name(self) -> str | None:
        """Tên named-vector cho search dense-only (VD: fast-paraphrase-...).

        Collection do fastembed tạo dùng named vectors; search không kèm
        `using` → Qdrant 400 "Vector params for  are not specified".
        Cache theo instance; collection unnamed (VectorParams) → None.
        """
        if self._vector_name_resolved:
            return self._vector_name
        try:
            info = await self.client.get_collection(self.collection_name)
            vectors = getattr(
                getattr(getattr(info, "config", None), "params", None), "vectors", None
            )
            if isinstance(vectors, dict) and vectors:
                slug = self.dense_model.lower().replace("/", "-").replace("_", "-")
                for name in vectors:
                    norm = str(name).lower().replace("_", "-")
                    if slug in norm or norm in slug:
                        self._vector_name = str(name)
                        break
                else:
                    self._vector_name = str(next(iter(vectors)))
        except Exception as e:
            logger.warning("Không resolve được vector name, thử unnamed: %s", e)
        self._vector_name_resolved = True
        return self._vector_name

    async def _ensure_collection_exists(self):
        """Khởi tạo collection nếu chưa tồn tại"""
        self._ensure_models()
        if getattr(self, "_collection_ensured", False):
            return
        if not await self.client.collection_exists(self.collection_name):
            logger.info("Creating Qdrant collection: %s", self.collection_name)
            # recreate_collection sẽ tạo collection với cấu hình embedding hiện tại
            # từ fastembed model đã set (hybrid hoặc dense-only tùy môi trường).
            if self._hybrid:
                await self.client.recreate_collection(
                    collection_name=self.collection_name,
                    vectors_config=self.client.get_fastembed_vector_params(),
                    sparse_vectors_config=self.client.get_fastembed_sparse_vector_params(),
                )
            else:
                await self.client.recreate_collection(
                    collection_name=self.collection_name,
                    vectors_config=self.client.get_fastembed_vector_params(),
                )
        self._collection_ensured = True

    async def upsert_vectors(
        self, tenant_id: str, chunks: list[str], metadatas: list[dict[str, Any]]
    ) -> None:
        """
        Lưu embeddings (Dense + Sparse) cùng với metadata `tenant_id`.
        """
        try:
            await self._ensure_collection_exists()

            # Gắn tenant_id vào mỗi metadata để đảm bảo data isolation
            for meta in metadatas:
                meta["tenant_id"] = tenant_id

            # fastembed client tự động sinh text embeddings và sparse vectors
            # uuid generation cho id nếu cần, nhưng .add() có thể tự sinh id.
            await self.client.add(
                collection_name=self.collection_name,
                documents=chunks,
                metadata=metadatas,
            )
        except Exception as e:
            logger.error("Error upserting vectors to Qdrant: %s", e)
            raise QdrantAdapterError(f"Upsert failed: {str(e)}") from e

    async def replace_tenant_vectors(
        self, tenant_id: str, chunks: list[str], metadatas: list[dict[str, Any]]
    ) -> None:
        """Xóa toàn bộ vector cũ của tenant rồi upsert lại (idempotent).

        Dùng cho RAG ingestion định kỳ: tránh tích lũy bản trùng và làm sạch
        citation cũ (VD: source_url nội bộ trước đây).
        """
        await self._ensure_collection_exists()
        try:
            tenant_filter = Filter(
                must=[
                    FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))
                ]
            )
            await self.client.delete(
                collection_name=self.collection_name,
                points_selector=tenant_filter,
            )
        except Exception as e:
            logger.warning("Không xóa được vector cũ của tenant %s: %s", tenant_id, e)
        if chunks:
            await self.upsert_vectors(tenant_id, chunks, metadatas)

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

            # Hybrid (Dense+BM25) khi đủ models, ngược lại dense-only.
            if self._hybrid:
                # query method của fastembed client hỗ trợ query_text và hybrid RRF
                results = await self.client.query(
                    collection_name=self.collection_name,
                    query_text=query,
                    query_filter=tenant_filter,
                    limit=limit,
                )
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
            else:
                query_vector = await self._dense_vector(query)
                using = await self._resolve_vector_name()
                # qdrant-client 1.10: named vector truyền dạng tuple (name, vector)
                # (không có kwarg `using`). Thiếu tên → Qdrant 400
                # "Vector params for  are not specified".
                qv = (using, query_vector) if using else query_vector
                points = await self.client.search(
                    collection_name=self.collection_name,
                    query_vector=qv,  # type: ignore[arg-type]
                    query_filter=tenant_filter,
                    limit=limit,
                    with_payload=True,
                )
                formatted_results = []
                for hit in points:
                    payload = dict(hit.payload or {})
                    formatted_results.append(
                        {
                            "id": hit.id,
                            "score": hit.score,
                            "document": payload.pop("document", None),
                            "metadata": payload,
                        }
                    )

            return formatted_results
        except Exception as e:
            logger.error("Error executing hybrid search in Qdrant: %s", e)
            raise QdrantAdapterError(f"Search failed: {str(e)}") from e

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
            raise QdrantAdapterError(f"Delete failed: {str(e)}") from e

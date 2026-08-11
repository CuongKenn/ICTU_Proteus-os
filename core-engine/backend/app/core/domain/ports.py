# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class AbstractDocumentSourcePort(ABC):
    """
    Port (Interface) cho nguồn cung cấp tài liệu (ví dụ: Outline, Notion, v.v.).
    Thuộc tầng Core Domain / Use Case, giúp đảm bảo Dependency Inversion Principle.
    """

    @abstractmethod
    async def list_documents(
        self, collection_id: Optional[str] = None, offset: int = 0, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Lấy danh sách documents từ nguồn."""
        pass


class AbstractVectorDBPort(ABC):
    """
    Port (Interface) cho cơ sở dữ liệu vector (ví dụ: Qdrant, Pinecone, v.v.).
    Thuộc tầng Core Domain / Use Case, giúp đảm bảo Dependency Inversion Principle.
    """

    @abstractmethod
    async def upsert_vectors(
        self, tenant_id: str, chunks: List[str], metadatas: List[Dict[str, Any]]
    ) -> None:
        """Upsert vectors vào database."""
        pass

    @abstractmethod
    async def search(
        self,
        tenant_id: str,
        query: str,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Tìm kiếm hybrid (vector + text)."""
        pass

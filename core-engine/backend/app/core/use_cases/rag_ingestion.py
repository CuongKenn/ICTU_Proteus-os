import logging
from typing import Any, Dict, List

from app.core.domain.ports import AbstractDocumentSourcePort, AbstractVectorDBPort

logger = logging.getLogger(__name__)


class RAGIngestionUseCase:
    """
    Use case cho RAG Document Ingestion.
    Luồng: Outline -> Chunking -> Embedding -> Qdrant.
    Cron: Chạy 2h sáng hàng đêm (được cấu hình ở scheduler/router).
    """

    def __init__(
        self,
        document_source_port: AbstractDocumentSourcePort,
        vector_db_port: AbstractVectorDBPort,
    ):
        self.document_source_port = document_source_port
        self.vector_db_port = vector_db_port
        self.max_chars_per_chunk = 2000  # Ước lượng ~512 tokens

    def _chunk_text(self, text: str) -> List[str]:
        """
        Chia text thành các chunks theo paragraph (\n\n) hoặc (\n).
        Đảm bảo max_chars_per_chunk.
        """
        if not text:
            return []

        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = ""

        for p in paragraphs:
            # Fallback split by \n if paragraph is still too long
            if len(p) > self.max_chars_per_chunk:
                lines = p.split("\n")
                for line in lines:
                    if (
                        len(current_chunk) + len(line) > self.max_chars_per_chunk
                        and current_chunk
                    ):
                        chunks.append(current_chunk.strip())
                        current_chunk = line
                    else:
                        current_chunk += "\n" + line if current_chunk else line
            else:
                if (
                    len(current_chunk) + len(p) > self.max_chars_per_chunk
                    and current_chunk
                ):
                    chunks.append(current_chunk.strip())
                    current_chunk = p
                else:
                    current_chunk += "\n\n" + p if current_chunk else p

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks

    async def execute(self, tenant_id: str) -> Dict[str, Any]:
        """
        Thực thi quy trình RAG Ingestion cho một tenant cụ thể.
        """
        logger.info(f"Starting RAG Ingestion for tenant: {tenant_id}")

        try:
            # 1. Fetch documents từ Outline
            documents = await self.document_source_port.list_documents()

            total_docs = len(documents)
            total_chunks = 0

            # 2. Chunking & 3. Upsert Qdrant
            for doc in documents:
                title = doc.get("title", "Untitled")
                source_url = doc.get("source_url", "")
                text = doc.get("text", "")

                chunks = self._chunk_text(text)

                if not chunks:
                    continue

                metadatas = [
                    {
                        "doc_title": title,
                        "source_url": source_url,
                        "document_id": doc.get("id"),
                    }
                    for _ in chunks
                ]

                # Upsert to Qdrant
                # QdrantAdapter sử dụng FastEmbed (Hybrid Search Dense+BM25) bên dưới,
                # thay thế cho việc gọi thẳng OpenAI API, tối ưu cho RRF.
                await self.vector_db_port.upsert_vectors(
                    tenant_id=tenant_id, chunks=chunks, metadatas=metadatas
                )
                total_chunks += len(chunks)

            logger.info(
                f"RAG Ingestion completed: {total_docs} docs, {total_chunks} chunks."
            )
            return {
                "status": "success",
                "processed_documents": total_docs,
                "upserted_chunks": total_chunks,
            }
        except Exception as e:
            logger.error(f"RAG Ingestion failed: {e}")
            return {"status": "failed", "error": str(e)}

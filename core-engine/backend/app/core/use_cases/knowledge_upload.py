# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Use Case — Knowledge Upload: file (PDF/DOCX/TXT/MD) → trích văn bản → Outline.
# Mỗi file thành 1 tài liệu Wiki (tiêu đề = tên file). File .doc đời cũ
# không hỗ trợ — báo lỗi rõ thay vì im lặng.

import io
import logging
import os
from typing import Any

from app.core.domain.ports import AbstractDocumentSourcePort

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB mỗi file

SUPPORTED_EXTS = frozenset({".pdf", ".docx", ".txt", ".md"})


class UnsupportedFileError(ValueError):
    pass


def extract_text(filename: str, content: bytes) -> str:
    """Trích văn bản thuần từ bytes theo đuôi file.

    Raise UnsupportedFileError khi định dạng không hỗ trợ hoặc
    không trích được chữ nào (VD: PDF scan toàn ảnh).
    Hàm thuần — không chạm DB/mạng nên dễ test.
    """
    ext = os.path.splitext(filename or "")[1].lower()

    if ext == ".doc":
        raise UnsupportedFileError(
            f"File '{filename}' là Word đời cũ (.doc) — "
            "mở bằng Word và lưu lại thành .docx rồi tải lên."
        )
    if ext not in SUPPORTED_EXTS:
        raise UnsupportedFileError(
            f"File '{filename}' chưa hỗ trợ (chỉ nhận PDF, DOCX, TXT, MD)."
        )
    if not content:
        raise UnsupportedFileError(f"File '{filename}' rỗng.")

    if ext in (".txt", ".md"):
        for encoding in ("utf-8-sig", "utf-16", "cp1258", "latin-1"):
            try:
                text = content.decode(encoding)
                break
            except (UnicodeDecodeError, ValueError):
                continue
        else:
            raise UnsupportedFileError(
                f"File '{filename}' mã hóa lạ — lưu lại dạng UTF-8 rồi thử lại."
            )
    elif ext == ".pdf":
        from pypdf import PdfReader

        try:
            reader = PdfReader(io.BytesIO(content))
        except Exception as e:
            raise UnsupportedFileError(
                f"File '{filename}' không phải PDF hợp lệ."
            ) from e
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        text = "\n\n".join(p.strip() for p in parts if p and p.strip())
        if not text.strip():
            raise UnsupportedFileError(
                f"File '{filename}' không trích được chữ nào — "
                "có thể là PDF scan (toàn ảnh). Hãy dùng bản PDF chữ."
            )
    else:  # .docx
        from docx import Document

        try:
            doc = Document(io.BytesIO(content))
        except Exception as e:
            raise UnsupportedFileError(
                f"File '{filename}' không phải DOCX hợp lệ."
            ) from e
        parts = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if cells:
                    parts.append(" | ".join(cells))
        text = "\n\n".join(parts)
        if not text.strip():
            raise UnsupportedFileError(f"File '{filename}' không có chữ nào để đăng.")

    return text.strip()


def title_from_filename(filename: str) -> str:
    base = os.path.basename(filename or "tai-lieu").strip()
    stem, _ = os.path.splitext(base)
    return stem.strip() or "Tài liệu tải lên"


class KnowledgeUploadUseCase:
    """Upload 1 file → trích chữ → publish lên nguồn tri thức (Outline)."""

    def __init__(self, document_source: AbstractDocumentSourcePort):
        self.document_source = document_source

    async def execute(
        self,
        *,
        filename: str,
        content: bytes,
        collection_id: str | None = None,
    ) -> dict[str, Any]:
        if len(content) > MAX_UPLOAD_BYTES:
            raise UnsupportedFileError(
                f"File '{filename}' quá {MAX_UPLOAD_BYTES // (1024 * 1024)}MB — "
                "chia nhỏ file rồi tải từng phần."
            )
        text = extract_text(filename, content)
        title = title_from_filename(filename)
        try:
            doc = await self.document_source.publish_document(
                title=title,
                text=text,
                collection_id=collection_id,
            )
        except NotImplementedError as e:
            raise UnsupportedFileError("Nguồn tri thức chưa hỗ trợ đăng bài.") from e
        logger.info("Knowledge upload xong: '%s' (%d ký tự)", title, len(text))
        return {
            "status": "success",
            "filename": filename,
            "title": doc.get("title", title),
            "url": doc.get("url"),
            "chars": len(text),
        }

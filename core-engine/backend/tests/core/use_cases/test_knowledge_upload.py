# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.use_cases.knowledge_upload import (
    UnsupportedFileError,
    extract_text,
    title_from_filename,
)


def test_extract_txt():
    text = extract_text("quy-dinh.txt", "Điều 1: Đi làm đúng giờ.".encode("utf-8"))
    assert "Đi làm đúng giờ" in text


def test_extract_docx(tmp_path=None):
    from docx import Document

    import io

    buf = io.BytesIO()
    doc = Document()
    doc.add_paragraph("Nội quy công ty 2026")
    doc.save(buf)
    text = extract_text("noi-quy.docx", buf.getvalue())
    assert "Nội quy công ty 2026" in text


def test_extract_pdf():
    from pypdf import PdfWriter

    import io

    buf = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.write(buf)
    # PDF trắng không có chữ → phải báo lỗi rõ, không im lặng
    with pytest.raises(UnsupportedFileError):
        extract_text("scan.pdf", buf.getvalue())


def test_reject_doc_and_unknown():
    with pytest.raises(UnsupportedFileError, match="Word đời cũ"):
        extract_text("cu.doc", b"dummy")
    with pytest.raises(UnsupportedFileError, match="chưa hỗ trợ"):
        extract_text("anh.png", b"dummy")
    with pytest.raises(UnsupportedFileError):
        extract_text("rong.txt", b"")


def test_title_from_filename():
    assert title_from_filename("/tmp/Quy dinh nghi phep.docx") == "Quy dinh nghi phep"
    assert title_from_filename("") == "tai-lieu"


@pytest.mark.asyncio
async def test_upload_use_case_publishes():
    source = MagicMock()
    source.publish_document = AsyncMock(
        return_value={"id": "1", "url": "http://wiki/doc/abc", "title": "Quy dinh"}
    )
    from app.core.use_cases.knowledge_upload import KnowledgeUploadUseCase

    uc = KnowledgeUploadUseCase(document_source=source)
    result = await uc.execute(
        filename="quy-dinh.txt",
        content="Nội dung mẫu".encode("utf-8"),
        collection_id=None,
    )
    assert result["status"] == "success"
    assert result["url"] == "http://wiki/doc/abc"
    source.publish_document.assert_awaited_once()


@pytest.mark.asyncio
async def test_upload_rejects_oversize():
    from app.core.use_cases.knowledge_upload import (
        MAX_UPLOAD_BYTES,
        KnowledgeUploadUseCase,
    )

    uc = KnowledgeUploadUseCase(document_source=MagicMock())
    with pytest.raises(UnsupportedFileError, match="quá"):
        await uc.execute(
            filename="lon.pdf", content=b"x" * (MAX_UPLOAD_BYTES + 1)
        )

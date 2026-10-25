# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Test tổng hợp đáp án RAG thành văn xuôi (mock LLM, no DB)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.domain.entities import AICommandStatus
from app.core.use_cases.ai_chat import AIChatUseCase, _append_sources, _strip_think


def _chat(answer=None, *, fail=False):
    llm = AsyncMock()
    if fail:
        llm.ainvoke.side_effect = RuntimeError("llm down")
    else:
        llm.ainvoke.return_value = SimpleNamespace(content=answer)
    return AIChatUseCase(llm_port=llm, ai_command_use_case=AsyncMock())


def _outcome(action="core.knowledge.search", cites=None):
    return {
        "index": 1,
        "command_id": str(uuid.uuid4()),
        "action": action,
        "effect": "read",
        "status": AICommandStatus.COMPLETED.value,
        "message": "ok",
        "result": {"query": "q", "citations": cites or []},
        "approval_message": None,
    }


def _cite(title="Nội quy", body="Nhân viên có 12 ngày phép."):
    return {
        "document": body,
        "score": 0.9,
        "doc_title": title,
        "source_url": "http://wiki/doc/x",
    }


@pytest.mark.asyncio
async def test_finish_synthesizes_knowledge_answer():
    chat = _chat("Theo [1], nhân viên có 12 ngày phép.")
    overall, summary, result = await chat._finish(
        [_outcome(cites=[_cite()])], 1, None, "done", question="Quy định nghỉ phép?"
    )
    assert overall == AICommandStatus.COMPLETED
    assert summary.startswith("Theo [1], nhân viên có 12 ngày phép.")
    # Nguồn thật (tên + link) được gắn cuối, thay vì "[1]" trơ trụi.
    assert "Nguồn:\n- Nội quy — http://wiki/doc/x" in summary
    # Steps gốc giữ nguyên để UI vẫn hiện link nguồn.
    assert result["steps"][0]["action"] == "core.knowledge.search"
    # Prompt tổng hợp gọi ainvoke văn xuôi, kèm câu hỏi + trích dẫn.
    prompt = chat.llm_port.ainvoke.await_args[0][0]
    assert any("Quy định nghỉ phép?" in m["content"] for m in prompt)
    assert any("Nội quy" in m["content"] for m in prompt)


@pytest.mark.asyncio
async def test_finish_keeps_chunks_when_llm_fails():
    chat = _chat(fail=True)
    overall, summary, _ = await chat._finish(
        [_outcome(cites=[_cite()])], 1, None, "done", question="q?"
    )
    assert overall == AICommandStatus.COMPLETED
    assert "Nội quy" in summary  # fallback: list chunks cũ


@pytest.mark.asyncio
async def test_synthesis_strips_think_block():
    chat = _chat("<think>đang suy nghĩ...</think>Theo [1], có 12 ngày phép.")
    overall, summary, _ = await chat._finish(
        [_outcome(cites=[_cite()])], 1, None, "done", question="q?"
    )
    assert overall == AICommandStatus.COMPLETED
    assert summary == "Theo [1], có 12 ngày phép.\n\nNguồn:\n- Nội quy — http://wiki/doc/x"
    assert "<think>" not in summary


def test_strip_think_no_tag():
    assert _strip_think("Đáp án thường.") == "Đáp án thường."


def test_append_sources_replaces_llm_trailer_and_dedupes():
    cites = [
        {"doc_title": "A", "source_url": "http://wiki/a"},
        {"doc_title": "A (trùng)", "source_url": "http://wiki/a"},
        {"doc_title": "B", "source_url": "http://wiki/b"},
    ]
    out = _append_sources("Đáp án.\n\nNguồn: [1], [2], [3].", cites)
    assert "Nguồn: [1]" not in out
    assert out.count("http://wiki/a") == 1
    assert "- A — http://wiki/a" in out
    assert "- B — http://wiki/b" in out


def test_append_sources_no_citations_keeps_text():
    assert _append_sources("Đáp án.", []) == "Đáp án."


@pytest.mark.asyncio
async def test_no_synthesis_without_citations():
    chat = _chat("should not be used")
    overall, summary, _ = await chat._finish(
        [_outcome(cites=[])], 1, None, "done", question="q?"
    )
    assert overall == AICommandStatus.COMPLETED
    chat.llm_port.ainvoke.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_synthesis_for_non_knowledge_turn():
    chat = _chat("should not be used")
    outcome = _outcome(action="core.chat.reply")
    outcome["result"] = "Xin chào!"
    overall, summary, _ = await chat._finish(
        [outcome], 1, None, "done", question="xin chào"
    )
    assert summary == "Xin chào!"
    chat.llm_port.ainvoke.assert_not_awaited()

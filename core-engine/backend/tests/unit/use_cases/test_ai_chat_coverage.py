# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Coverage bổ sung cho AIChatUseCase (mock LLM/repo, no DB)."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.domain.entities import AICommandStatus
from app.core.use_cases.action_catalog import FALLBACK_PROMPT_ACTIONS
from app.core.use_cases.ai_chat import AIChatDTO, AIChatUseCase, MAX_PLAN_STEPS
from app.core.use_cases.ai_command import AICommandDTO


def _dto(text="xin chào"):
    return AIChatDTO(session_id=uuid.uuid4(), natural_language_input=text)


def _cmd(action="core.chat.reply", effect="read", params=None):
    return AICommandDTO(
        command_id=uuid.uuid4(),
        dsl_version="1.0",
        action=action,
        effect=effect,
        parameters=params or {"reply": "hi"},
    )


def _llm(content, *, has_json=True):
    m = AsyncMock()
    if has_json:
        m.ainvoke_json.return_value = SimpleNamespace(content=content)
    else:
        del m.ainvoke_json
        m.ainvoke.return_value = SimpleNamespace(content=content)
    return m


@pytest.fixture
def uc_mock():
    uc = AsyncMock()
    uc.execute.return_value = (AICommandStatus.COMPLETED, "ok", {"r": 1})
    uc.ai_command_repo = AsyncMock()
    uc.ai_command_repo.get_command_by_id.return_value = None
    return uc


@pytest.fixture
def chat(uc_mock):
    return AIChatUseCase(llm_port=_llm('{"action": "x"}'), ai_command_use_case=uc_mock)


# ─── parse helpers ──────────────────────────────────────────────────────────


def test_single_fallback(chat):
    dto = _dto()
    cmd = chat._single_fallback(dto)
    assert cmd.action == "core.chat.reply" and cmd.effect == "read"


def test_step_from_dict(chat):
    dto = _dto()
    assert chat._step_from_dict({"no": 1}, dto) is None
    assert chat._step_from_dict("str", dto) is None
    s = chat._step_from_dict(
        {"action": "a.b", "effect": "bogus", "parameters": "nope"}, dto
    )
    assert s.effect == "read" and s.parameters == {"raw_input": dto.natural_language_input}
    s2 = chat._step_from_dict({"action": "a.b"}, dto)
    assert s2.effect == "read"


def test_parse_plan_invalid_json(chat):
    plan = chat._parse_plan("not json at all {{{", _dto())
    assert len(plan) == 1 and plan[0].action == "core.chat.reply"


def test_parse_plan_truncates(chat):
    import json

    steps = [
        {"action": f"a.{i}", "effect": "read", "parameters": {}} for i in range(6)
    ]
    plan = chat._parse_plan(json.dumps({"goal": "g", "steps": steps}), _dto())
    assert len(plan) == MAX_PLAN_STEPS


def test_parse_plan_single_and_empty(chat):
    import json

    plan = chat._parse_plan(
        json.dumps({"action": "core.users.list", "effect": "read"}), _dto()
    )
    assert plan[0].action == "core.users.list"
    plan2 = chat._parse_plan(json.dumps({"goal": "g", "steps": []}), _dto())
    assert plan2[0].action == "core.chat.reply"
    plan3 = chat._parse_plan(json.dumps({"goal": "g", "steps": [{"x": 1}]}), _dto())
    assert plan3[0].action == "core.chat.reply"
    assert isinstance(chat._parse_plan("[1,2]", _dto()), list)


def test_parse_command(chat):
    cmd = chat._parse_command('{"action": "a.b"}', _dto())
    assert cmd.action == "a.b"


def test_parse_react(chat):
    t, nxt, fin = chat._parse_react("garbage {{{")
    assert fin is True and nxt is None
    t, nxt, fin = chat._parse_react("[1,2]")
    assert fin is True
    t, nxt, fin = chat._parse_react('{"thought": "ok", "finish": true}')
    assert (t, nxt, fin) == ("ok", None, True)
    t, nxt, fin = chat._parse_react(
        '{"thought": "go", "next_action": {"action": "a.b"}}'
    )
    assert fin is False and nxt["action"] == "a.b"
    t, nxt, fin = chat._parse_react('{"action": "a.b", "effect": "read"}')
    assert fin is True and nxt["action"] == "a.b"
    t, nxt, fin = chat._parse_react('{"thought": "hmm"}')
    assert fin is True and nxt is None


# ─── _summarize ─────────────────────────────────────────────────────────────


def _outcome(i, action, status, msg="ok", result=None):
    return {
        "index": i, "command_id": str(uuid.uuid4()), "action": action,
        "effect": "read", "status": status, "message": msg, "result": result,
    }


def test_summarize_chat_reply_passthrough(chat):
    o = _outcome(1, "core.chat.reply", "COMPLETED", result="Xin chào!")
    st, msg, res = chat._summarize([o], 1)
    assert st == AICommandStatus.COMPLETED and msg == "Xin chào!"


def test_summarize_single_completed(chat):
    o = _outcome(1, "core.users.list", "COMPLETED")
    st, msg, res = chat._summarize([o], 1)
    assert st == AICommandStatus.COMPLETED and "Đã xong" in msg


def test_summarize_multi_iters_with_thoughts(chat):
    outs = [_outcome(1, "a.1", "COMPLETED"), _outcome(2, "a.2", "COMPLETED")]
    st, msg, res = chat._summarize(outs, 2, ["t1"], "iters")
    assert st == AICommandStatus.COMPLETED
    assert "giới hạn vòng lặp" in msg and "Suy luận" in msg
    assert res["thoughts"] == ["t1"]


def test_summarize_pending_and_failed(chat):
    outs = [
        _outcome(1, "a.1", "COMPLETED"),
        _outcome(2, "a.2", "PENDING_APPROVAL", "cho duyet"),
    ]
    st, msg, _ = chat._summarize(outs, 2)
    assert st == AICommandStatus.PENDING_APPROVAL and "chờ phê duyệt" in msg
    outs2 = [_outcome(1, "a.1", "FAILED", "boom")]
    st2, msg2, _ = chat._summarize(outs2, 1)
    assert st2 == AICommandStatus.FAILED and "boom" in msg2


# ─── _pending_preview / _finish ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pending_preview_none(chat):
    assert await chat._pending_preview([_outcome(1, "a", "COMPLETED")]) is None


@pytest.mark.asyncio
async def test_pending_preview_with_deadline(chat, uc_mock):
    import datetime

    uc_mock.ai_command_repo.get_command_by_id.return_value = {
        "approval_deadline": datetime.datetime(2026, 5, 1, 10, 0, 0)
    }
    o = _outcome(1, "a.b", "PENDING_APPROVAL", result={"affected_count": 1})
    o["approval_message"] = "duyet?"
    prev = await chat._pending_preview([o])
    assert prev["action"] == "a.b"
    assert prev["approval_deadline"] == "2026-05-01T10:00:00"
    assert prev["dry_run_result"] == {"affected_count": 1}


@pytest.mark.asyncio
async def test_pending_preview_repo_error(chat, uc_mock):
    uc_mock.ai_command_repo.get_command_by_id.side_effect = RuntimeError("db")
    o = _outcome(1, "a.b", "PENDING_APPROVAL")
    prev = await chat._pending_preview([o])
    assert prev["approval_deadline"] is None


@pytest.mark.asyncio
async def test_finish_attaches_preview(chat, uc_mock):
    uc_mock.ai_command_repo.get_command_by_id.return_value = {
        "approval_deadline": "tomorrow"
    }
    outs = [_outcome(1, "a.b", "PENDING_APPROVAL")]
    st, _, res = await chat._finish(outs, 1, None, "done")
    assert st == AICommandStatus.PENDING_APPROVAL
    assert res["dsl_preview"]["approval_deadline"] == "tomorrow"


# ─── _persist_turn / _build_messages ────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_no_repo(chat):
    await chat._persist_turn({}, uuid.uuid4(), "user", "hi")


@pytest.mark.asyncio
async def test_persist_dict_ctx_ok(uc_mock):
    repo = AsyncMock()
    repo.ensure_session.return_value = "sess"
    c = AIChatUseCase(
        llm_port=_llm("{}"), ai_command_use_case=uc_mock, conversation_repo=repo
    )
    ctx = {"tenant_id": "t", "user_id": "u"}
    await c._persist_turn(ctx, uuid.uuid4(), "user", "hi")
    repo.append_message.assert_awaited_once()
    repo.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_persist_object_ctx_and_error(uc_mock):
    repo = AsyncMock()
    repo.ensure_session.side_effect = RuntimeError("db down")
    c = AIChatUseCase(
        llm_port=_llm("{}"), ai_command_use_case=uc_mock, conversation_repo=repo
    )
    ctx = SimpleNamespace(tenant_id="t", user_id="u")
    await c._persist_turn(ctx, uuid.uuid4(), "user", "hi")  # swallowed


@pytest.mark.asyncio
async def test_build_messages_dict_and_object(chat):
    msgs = await chat._build_messages({"tenant_id": "t"}, "hello")
    assert msgs[0]["role"] == "system" and msgs[1]["content"] == "hello"
    ctx = SimpleNamespace(tenant_id="t")
    msgs2 = await chat._build_messages(ctx, "hi")
    assert "Proteus AI" in msgs2[0]["content"]


@pytest.mark.asyncio
async def test_build_messages_catalog_error(uc_mock):
    from unittest.mock import patch

    c = AIChatUseCase(llm_port=_llm("{}"), ai_command_use_case=uc_mock)
    with patch(
        "app.core.use_cases.ai_chat.build_catalog_for_tenant",
        side_effect=RuntimeError("x"),
    ):
        msgs = await c._build_messages({"tenant_id": "t"}, "hi")
    assert FALLBACK_PROMPT_ACTIONS in msgs[0]["content"]


# ─── _llm_text / execute ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_llm_text_json_and_plain(uc_mock):
    c = AIChatUseCase(llm_port=_llm("hello"), ai_command_use_case=uc_mock)
    assert await c._llm_text([]) == "hello"
    c2 = AIChatUseCase(
        llm_port=_llm("hello", has_json=False), ai_command_use_case=uc_mock
    )
    assert await c2._llm_text([]) == "hello"


@pytest.mark.asyncio
async def test_execute_no_llm(uc_mock):
    c = AIChatUseCase(
        llm_port=None, ai_command_use_case=uc_mock, conversation_repo=AsyncMock()
    )
    st, msg, res = await c.execute(_dto(), {"tenant_id": "t", "user_id": "u"})
    assert st == AICommandStatus.FAILED and msg == "AI Service Unavailable"


@pytest.mark.asyncio
async def test_execute_success_single(chat, uc_mock):
    chat.llm_port = _llm('{"action": "core.chat.reply", "effect": "read", '
                         '"parameters": {"reply": "Chào bạn!"}}')
    uc_mock.execute.return_value = (
        AICommandStatus.COMPLETED, "ok", "Chào bạn!",
    )
    st, msg, res = await chat.execute(_dto(), {"tenant_id": "t", "user_id": "u"})
    assert st == AICommandStatus.COMPLETED and msg == "Chào bạn!"


@pytest.mark.asyncio
async def test_execute_llm_error(chat):
    chat.llm_port = _llm("x")
    chat.llm_port.ainvoke_json.side_effect = RuntimeError("llm down")
    st, msg, _ = await chat.execute(_dto(), {"tenant_id": "t"})
    assert st == AICommandStatus.FAILED and "Lỗi hệ thống" in msg


# ─── _run_plan / _run_react ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_plan_all_completed(chat, uc_mock):
    plan = [_cmd("a.1"), _cmd("a.2")]
    st, msg, res = await chat._run_plan(plan, _dto(), {})
    assert st == AICommandStatus.COMPLETED and res["plan_total"] == 2


@pytest.mark.asyncio
async def test_run_plan_pending_break(chat, uc_mock):
    uc_mock.execute.return_value = (AICommandStatus.PENDING_APPROVAL, "wait", None)
    st, msg, _ = await chat._run_plan([_cmd("a.1"), _cmd("a.2")], _dto(), {})
    assert st == AICommandStatus.PENDING_APPROVAL and "0/2" in msg


@pytest.mark.asyncio
async def test_run_plan_failed_with_callbacks(chat, uc_mock):
    uc_mock.execute.return_value = (AICommandStatus.FAILED, "bad", None)
    calls = []

    async def on_step(i, step, status, message):
        calls.append(i)

    st, _, _ = await chat._run_plan(
        [_cmd("a.1")], _dto(), {}, on_step=on_step
    )
    assert st == AICommandStatus.FAILED and calls == [0]
    # sync callback variant
    st2, _, _ = await chat._run_plan(
        [_cmd("a.1")], _dto(), {}, on_step=lambda *a: calls.append(9)
    )
    assert st2 == AICommandStatus.FAILED and 9 in calls


@pytest.mark.asyncio
async def test_run_react_first_pending(chat, uc_mock):
    uc_mock.execute.return_value = (AICommandStatus.PENDING_APPROVAL, "wait", None)
    st, _, res = await chat._run_react([_cmd("a.1")], _dto(), {})
    assert st == AICommandStatus.PENDING_APPROVAL


@pytest.mark.asyncio
async def test_run_react_loop_finish(chat, uc_mock):
    chat.llm_port = _llm('{"thought": "xong", "finish": true}')
    st, _, res = await chat._run_react([_cmd("a.1"), _cmd("a.2")], _dto(), {})
    assert st == AICommandStatus.COMPLETED
    assert res["steps"][0]["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_run_react_timeout(chat, uc_mock, monkeypatch):
    monkeypatch.setattr("app.core.use_cases.ai_chat.REACT_TIME_BUDGET_S", -1)
    uc_mock.execute.return_value = (AICommandStatus.FAILED, "bad", None)
    st, _, _ = await chat._run_react([_cmd("a.1"), _cmd("a.2")], _dto(), {})
    assert st == AICommandStatus.FAILED


@pytest.mark.asyncio
async def test_run_react_llm_error_breaks(chat, uc_mock):
    uc_mock.execute.return_value = (AICommandStatus.FAILED, "bad", None)
    chat.llm_port = _llm("x")
    chat.llm_port.ainvoke_json.side_effect = RuntimeError("down")
    st, _, _ = await chat._run_react([_cmd("a.1")], _dto(), {})
    assert st == AICommandStatus.FAILED


@pytest.mark.asyncio
async def test_run_react_next_step_pending(chat, uc_mock):
    uc_mock.execute.side_effect = [
        (AICommandStatus.FAILED, "bad", None),
        (AICommandStatus.PENDING_APPROVAL, "wait", None),
    ]
    chat.llm_port = _llm('{"thought": "retry", "next_action": {"action": "a.2"}}')
    events = []
    st, _, _ = await chat._run_react(
        [_cmd("a.1")], _dto(), {},
        on_event=lambda e, p: events.append(e),
    )
    assert st == AICommandStatus.PENDING_APPROVAL
    assert "thought" in events and "step" in events


# ─── execute_stream ─────────────────────────────────────────────────────────


class _StreamLLM:
    def __init__(self, chunks, followup='{"thought": "ok", "finish": true}'):
        self._chunks = chunks
        self._follow = followup

    async def astream(self, messages):
        for ch in self._chunks:
            yield ch

    async def ainvoke_json(self, messages):
        return SimpleNamespace(content=self._follow)


@pytest.mark.asyncio
async def test_stream_no_llm(uc_mock):
    c = AIChatUseCase(llm_port=None, ai_command_use_case=uc_mock)
    events = [e async for e in c.execute_stream(_dto(), {})]
    assert events[0]["event"] == "started"
    assert events[1]["event"] == "result"
    assert events[1]["status"] == "FAILED"


@pytest.mark.asyncio
async def test_stream_astream_success(uc_mock):
    llm = _StreamLLM(['{"action": "core.chat.reply", "effect": "read",',
                      ' "parameters": {"reply": "hi"}}'])
    uc_mock.execute.return_value = (AICommandStatus.COMPLETED, "ok", "hi")
    c = AIChatUseCase(llm_port=llm, ai_command_use_case=uc_mock)
    events = [e async for e in c.execute_stream(_dto(), {"tenant_id": "t"})]
    kinds = [e["event"] for e in events]
    assert kinds[0] == "started" and "token" in kinds
    assert "plan" in kinds and kinds[-1] == "result"
    assert events[-1]["status"] == "COMPLETED"


@pytest.mark.asyncio
async def test_stream_ainvoke_fallback(uc_mock):
    # SimpleNamespace without astream -> falls back to ainvoke_json path.
    llm = SimpleNamespace(
        ainvoke_json=AsyncMock(return_value=SimpleNamespace(content='{"action": "a.b"}'))
    )
    c = AIChatUseCase(llm_port=llm, ai_command_use_case=uc_mock)
    events = [e async for e in c.execute_stream(_dto(), {})]
    assert events[-1]["event"] == "result"


@pytest.mark.asyncio
async def test_stream_llm_error(uc_mock):
    llm = _StreamLLM([])
    uc_mock.execute.side_effect = RuntimeError("exec down")

    async def _boom(messages):
        raise RuntimeError("stream down")
        yield  # noqa: unreachable — makes it an async generator

    llm.astream = _boom
    c = AIChatUseCase(llm_port=llm, ai_command_use_case=uc_mock)
    events = [e async for e in c.execute_stream(_dto(), {})]
    assert events[-1]["event"] == "result"
    assert events[-1]["status"] == "FAILED"


@pytest.mark.asyncio
async def test_stream_exec_error_wrapped(uc_mock):
    llm = _StreamLLM(['{"action": "a.b"}'])
    uc_mock.execute.side_effect = RuntimeError("exec down")
    c = AIChatUseCase(llm_port=llm, ai_command_use_case=uc_mock)
    events = [e async for e in c.execute_stream(_dto(), {})]
    assert events[-1]["status"] == "FAILED"

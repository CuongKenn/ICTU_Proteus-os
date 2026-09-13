# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Tests cho đợt nâng cấp Proteus AI: structured JSON, catalog động,
validator 2-part, conversation use-case."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.ai.llm_provider import extract_json_object
from app.core.use_cases.action_catalog import (
    build_catalog,
    infer_effect,
    render_for_prompt,
    split_plugin_action,
)
from app.core.use_cases.conversation import ConversationUseCase
from app.core.use_cases.dsl_validator import (
    DSLInvalidActionError,
    DSLPermissionDeniedError,
    DSLPluginNotActiveError,
    DSLValidator,
)


def test_extract_json_object_plain():
    assert extract_json_object('{"a": 1}') == '{"a": 1}'


def test_extract_json_object_fence_and_noise():
    text = 'Chắc chắn rồi!\n```json\n{"action": "x", "n": {"m": 1}}\n```\nXong.'
    assert extract_json_object(text) == '{"action": "x", "n": {"m": 1}}'


def test_extract_json_object_balanced():
    text = 'prefix {"a": {"b": [1, {"c": "}"}]}} suffix'
    assert extract_json_object(text) == '{"a": {"b": [1, {"c": "}"}]}}'


def test_extract_json_object_missing():
    with pytest.raises(ValueError):
        extract_json_object("không có json ở đây")


def test_infer_effect():
    assert infer_effect("leave_balance_check") == "read"
    assert infer_effect("hr_summary_report") == "read"
    assert infer_effect("approve_request") == "write"


def test_split_plugin_action():
    assert split_plugin_action("hr.leave_request") == ("hr-module", "leave_request")
    assert split_plugin_action("hr.leave_requests.approve") is None
    assert split_plugin_action("novalue") is None


def _manifest_parser(plugins_dir="/tmp/proteus-test-plugins"):
    wf1 = SimpleNamespace(id="leave_request", file="workflows/leave_request.json",
                          name="Leave", description="Duyệt phép", trigger="webhook")
    wf2 = SimpleNamespace(id=None, file="workflows/nightly.json",
                          name="Night", description="Cron", trigger="cron")
    manifest = SimpleNamespace(
        name="hr-module", workflows=[wf1, wf2], roles=[]
    )

    class Parser:
        def __init__(self):
            self.plugins_dir = plugins_dir

        def parse(self, code):
            assert code == "hr-module"
            return manifest

    return Parser()


def test_build_catalog_includes_webhook_only(tmp_path):
    (tmp_path / "hr-module").mkdir()
    (tmp_path / "hr-module" / "manifest.yaml").touch()
    catalog = build_catalog(manifest_parser=_manifest_parser(str(tmp_path)))
    actions = [a.action for a in catalog]
    assert "hr.leave_request" in actions
    assert not any("nightly" in a for a in actions)
    prompt = render_for_prompt(catalog)
    assert "hr.leave_request" in prompt


class _PluginRepo:
    async def get_tenant_plugin_status_by_code(self, tenant_id, plugin_code):
        from app.core.domain.entities import PluginStatus

        if plugin_code == "hr-module":
            return PluginStatus.ACTIVE
        return None


def _role_repo(perms):
    mock = AsyncMock()
    mock.get_user_permissions.return_value = perms
    return mock


@pytest.mark.asyncio
async def test_validator_accepts_two_part_action():
    v = DSLValidator(
        plugin_repo=_PluginRepo(),
        role_repo=_role_repo(["hr:employees:read"]),
        tenant_id="t1",
        user_id="12345678-1234-5678-1234-567812345678",
        manifest_parser=_manifest_parser(),
    )
    assert await v.validate(
        {"dsl_version": "1.0", "action": "hr.leave_request", "parameters": {}}
    ) is True


@pytest.mark.asyncio
async def test_validator_rejects_unknown_workflow():
    v = DSLValidator(
        plugin_repo=_PluginRepo(),
        role_repo=_role_repo(["hr:employees:read"]),
        tenant_id="t1",
        user_id="12345678-1234-5678-1234-567812345678",
        manifest_parser=_manifest_parser(),
    )
    with pytest.raises(DSLInvalidActionError):
        await v.validate(
            {"dsl_version": "1.0", "action": "hr.nope", "parameters": {}}
        )


@pytest.mark.asyncio
async def test_validator_rejects_two_part_without_permission():
    v = DSLValidator(
        plugin_repo=_PluginRepo(),
        role_repo=_role_repo(["finance:reports:read"]),
        tenant_id="t1",
        user_id="12345678-1234-5678-1234-567812345678",
        manifest_parser=_manifest_parser(),
    )
    with pytest.raises(DSLPermissionDeniedError):
        await v.validate(
            {"dsl_version": "1.0", "action": "hr.leave_request", "parameters": {}}
        )


@pytest.mark.asyncio
async def test_validator_rejects_two_part_plugin_inactive():
    v = DSLValidator(
        plugin_repo=_PluginRepo(),
        role_repo=_role_repo(["crm:leads:read"]),
        tenant_id="t1",
        user_id="12345678-1234-5678-1234-567812345678",
        manifest_parser=_manifest_parser(),
    )
    with pytest.raises(DSLPluginNotActiveError):
        await v.validate(
            {"dsl_version": "1.0", "action": "crm.sync_now", "parameters": {}}
        )


@pytest.mark.asyncio
async def test_conversation_rejects_bad_role():
    use_case = ConversationUseCase(conversation_repo=AsyncMock())
    with pytest.raises(ValueError):
        await use_case.save_turn(
            uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), "hacker", "x"
        )


@pytest.mark.asyncio
async def test_conversation_save_delegates():
    repo = AsyncMock()
    repo.append_message.return_value = uuid.uuid4()
    use_case = ConversationUseCase(conversation_repo=repo)
    tid, uid, sid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    await use_case.save_turn(tid, uid, sid, "user", "hello")
    repo.append_message.assert_called_once()


@pytest.mark.asyncio
async def test_validator_public_core_read_needs_no_permission():
    from app.core.use_cases.dsl_validator import DSLValidator

    v = DSLValidator(
        plugin_repo=_PluginRepo(),
        role_repo=_role_repo([]),
        tenant_id="t1",
        user_id="12345678-1234-5678-1234-567812345678",
    )
    assert await v.validate(
        {
            "dsl_version": "1.0",
            "action": "core.knowledge.search",
            "effect": "read",
            "parameters": {"raw_input": "chính sách nghỉ phép?"},
        }
    ) is True


@pytest.mark.asyncio
async def test_validator_public_action_write_still_denied():
    from app.core.use_cases.dsl_validator import DSLPermissionDeniedError, DSLValidator

    v = DSLValidator(
        plugin_repo=_PluginRepo(),
        role_repo=_role_repo([]),
        tenant_id="t1",
        user_id="12345678-1234-5678-1234-567812345678",
    )
    with pytest.raises(DSLPermissionDeniedError):
        await v.validate(
            {
                "dsl_version": "1.0",
                "action": "core.knowledge.search",
                "effect": "write",
                "parameters": {},
            }
        )


def _chat_case(llm_content: str = ""):
    from unittest.mock import MagicMock

    from app.core.use_cases.ai_chat import AIChatDTO, AIChatUseCase

    llm = MagicMock()
    llm.ainvoke_json = AsyncMock(return_value=SimpleNamespace(content=llm_content))
    cmds = MagicMock()
    return AIChatUseCase(llm_port=llm, ai_command_use_case=cmds), cmds


@pytest.mark.asyncio
async def test_parse_plan_multi_step_truncates():
    from app.core.use_cases.ai_chat import AIChatDTO, MAX_PLAN_STEPS

    use_case, _ = _chat_case()
    steps = [
        {"action": f"hr.step{i}", "effect": "read", "parameters": {}}
        for i in range(MAX_PLAN_STEPS + 3)
    ]
    dto = AIChatDTO(
        session_id=uuid.uuid4(), natural_language_input="làm nhiều việc"
    )
    plan = use_case._parse_plan(
        '{"goal": "g", "steps": %s}'
        % __import__("json").dumps(steps),
        dto,
    )
    assert len(plan) == MAX_PLAN_STEPS
    assert plan[0].action == "hr.step0"


@pytest.mark.asyncio
async def test_parse_plan_legacy_single_and_garbage():
    from app.core.use_cases.ai_chat import AIChatDTO

    use_case, _ = _chat_case()
    dto = AIChatDTO(session_id=uuid.uuid4(), natural_language_input="xin chào")
    legacy = use_case._parse_plan(
        '{"action": "hr.employees.read", "effect": "read", '
        '"parameters": {"raw_input": "xin chào"}}',
        dto,
    )
    assert len(legacy) == 1 and legacy[0].action == "hr.employees.read"
    fallback = use_case._parse_plan("xin chào bạn", dto)
    assert len(fallback) == 1 and fallback[0].effect == "read"


@pytest.mark.asyncio
async def test_run_plan_stops_at_pending():
    from app.core.domain.entities import AICommandStatus
    from app.core.use_cases.ai_chat import AIChatDTO

    use_case, cmds = _chat_case()
    cmds.execute = AsyncMock(
        side_effect=[
            (AICommandStatus.COMPLETED, "ok 1", {"r": 1}),
            (AICommandStatus.PENDING_APPROVAL, "chờ duyệt", {"dry": True}),
            (AICommandStatus.COMPLETED, "ok 3", {"r": 3}),
        ]
    )
    dto = AIChatDTO(session_id=uuid.uuid4(), natural_language_input="duyệt phép")
    plan = use_case._parse_plan(
        '{"goal": "g", "steps": ['
        '{"action": "hr.a", "effect": "read", "parameters": {}},'
        '{"action": "hr.b", "effect": "write", "parameters": {}},'
        '{"action": "hr.c", "effect": "read", "parameters": {}}]}',
        dto,
    )
    status, message, result = await use_case._run_plan(plan, dto, {"tenant_id": "t"})
    assert status == AICommandStatus.PENDING_APPROVAL
    assert cmds.execute.call_count == 2
    assert result["plan_total"] == 3
    assert "1/3" in message or "2/3" in message


@pytest.mark.asyncio
async def test_run_plan_all_completed():
    from app.core.domain.entities import AICommandStatus
    from app.core.use_cases.ai_chat import AIChatDTO

    use_case, cmds = _chat_case()
    cmds.execute = AsyncMock(return_value=(AICommandStatus.COMPLETED, "ok", {}))
    dto = AIChatDTO(session_id=uuid.uuid4(), natural_language_input="tra cứu")
    plan = use_case._parse_plan(
        '{"goal": "g", "steps": ['
        '{"action": "hr.a", "effect": "read", "parameters": {}},'
        '{"action": "hr.b", "effect": "read", "parameters": {}}]}',
        dto,
    )
    status, message, result = await use_case._run_plan(plan, dto, {"tenant_id": "t"})
    assert status == AICommandStatus.COMPLETED
    assert cmds.execute.call_count == 2
    assert len(result["steps"]) == 2


@pytest.mark.asyncio
async def test_prompt_teaches_chitchat_via_llm():
    """Chitchat do LLM xử lý (không fast-path regex): prompt phải dạy tool
    core.chat.reply + ví dụ chào hỏi và hỏi khả năng."""
    from app.core.use_cases.ai_chat import AIChatDTO

    use_case, _ = _chat_case()
    use_case.plugin_repo = None
    use_case.manifest_parser = None
    messages = await use_case._build_messages(
        {"tenant_id": "t", "user_id": "u"}, "xin chào"
    )
    system = messages[0]["content"]
    assert "core.chat.reply" in system
    assert "xin chào" in system  # ví dụ few-shot chào hỏi
    assert "làm được gì" in system  # ví dụ hỏi khả năng


@pytest.mark.asyncio
async def test_fallback_is_safe_reply():
    from app.core.use_cases.ai_chat import AIChatDTO

    use_case, _ = _chat_case()
    dto = AIChatDTO(session_id=uuid.uuid4(), natural_language_input="???")
    fallback = use_case._single_fallback(dto)
    assert fallback.action == "core.chat.reply"
    assert fallback.effect == "read"


@pytest.mark.asyncio
async def test_chat_reply_public_and_local():
    from app.core.use_cases.ai_command import AICommandDTO
    from app.core.use_cases.dsl_validator import DSLValidator

    v = DSLValidator(
        plugin_repo=_PluginRepo(),
        role_repo=_role_repo([]),
        tenant_id="t1",
        user_id="12345678-1234-5678-1234-567812345678",
    )
    assert await v.validate(
        {
            "dsl_version": "1.0",
            "action": "core.chat.reply",
            "effect": "read",
            "parameters": {"reply": "chào bạn"},
        }
    ) is True


def _react_case(first_status, react_script):
    """LLM plan 2 steps + script các vòng ReAct tiếp theo."""
    from unittest.mock import MagicMock

    from app.core.domain.entities import AICommandStatus
    from app.core.use_cases.ai_chat import AIChatDTO, AIChatUseCase

    llm = MagicMock()
    llm.ainvoke_json = AsyncMock(
        side_effect=[
            SimpleNamespace(content=s) for s in react_script
        ]
    )
    cmds = MagicMock()
    use_case = AIChatUseCase(llm_port=llm, ai_command_use_case=cmds)
    return use_case, cmds


@pytest.mark.asyncio
async def test_react_single_step_no_extra_llm():
    from app.core.domain.entities import AICommandStatus
    from app.core.use_cases.ai_chat import AIChatDTO

    use_case, cmds = _chat_case()
    cmds.execute = AsyncMock(return_value=(AICommandStatus.COMPLETED, "ok", {}))
    dto = AIChatDTO(session_id=uuid.uuid4(), natural_language_input="tra cứu")
    seed = use_case._parse_plan(
        '{"action": "hr.a", "effect": "read", "parameters": {}}', dto
    )
    status, _, result = await use_case._run_react(seed, dto, {"tenant_id": "t"})
    assert status == AICommandStatus.COMPLETED
    assert cmds.execute.call_count == 1
    assert len(result["steps"]) == 1


@pytest.mark.asyncio
async def test_react_repairs_failed_step():
    import json as _json

    from app.core.domain.entities import AICommandStatus
    from app.core.use_cases.ai_chat import AIChatDTO

    use_case, cmds = _react_case(
        None,
        [
            _json.dumps(
                {
                    "thought": "bước 1 lỗi, thử action khác",
                    "next_action": {
                        "action": "hr.c",
                        "effect": "read",
                        "parameters": {},
                    },
                }
            ),
            _json.dumps({"thought": "xong", "finish": True}),
        ],
    )
    cmds.execute = AsyncMock(
        side_effect=[
            (AICommandStatus.FAILED, "lỗi", None),
            (AICommandStatus.COMPLETED, "ok cứu", {"r": 1}),
        ]
    )
    dto = AIChatDTO(session_id=uuid.uuid4(), natural_language_input="việc khó")
    seed = use_case._parse_plan(
        '{"goal": "g", "steps": ['
        '{"action": "hr.a", "effect": "read", "parameters": {}},'
        '{"action": "hr.b", "effect": "read", "parameters": {}}]}',
        dto,
    )
    status, message, result = await use_case._run_react(seed, dto, {"tenant_id": "t"})
    assert status == AICommandStatus.COMPLETED
    assert cmds.execute.call_count == 2
    assert any(s["action"] == "hr.c" for s in result["steps"])
    assert "Suy luận" in message


@pytest.mark.asyncio
async def test_react_parse_variants():
    from app.core.use_cases.ai_chat import AIChatDTO

    use_case, _ = _chat_case()
    thought, nxt, finish = use_case._parse_react(
        '{"thought": "làm tiếp", "next_action": {"action": "hr.b", "parameters": {}}}'
    )
    assert thought == "làm tiếp" and nxt["action"] == "hr.b" and finish is False
    thought, nxt, finish = use_case._parse_react('{"thought": "xong", "finish": true}')
    assert finish is True and nxt is None
    thought, nxt, finish = use_case._parse_react("rác không json")
    assert finish is True and nxt is None


@pytest.mark.asyncio
async def test_no_regex_fast_paths():
    """Không còn fast-path regex: mọi input đều qua LLM."""
    import app.core.use_cases.ai_chat as mod

    assert not hasattr(mod.AIChatUseCase, "_greeting_plan")
    assert not hasattr(mod.AIChatUseCase, "_direct_plan")
    assert not hasattr(mod, "_GREETING_RE")
    assert not hasattr(mod, "_CAPABILITY_RE")

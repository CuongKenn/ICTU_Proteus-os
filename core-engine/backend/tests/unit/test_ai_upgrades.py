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


@pytest.mark.asyncio
async def test_chatreply_renders_clean_text():
    """Reply thuần trả thẳng text (string), summary bỏ wrapper kỹ thuật."""
    from unittest.mock import MagicMock

    from app.core.domain.entities import AICommandStatus
    from app.core.use_cases.ai_chat import AIChatDTO, AIChatUseCase

    cmds = MagicMock()
    cmds.execute = AsyncMock(
        return_value=(AICommandStatus.COMPLETED, "Lệnh đọc xong.", "Xin chào bạn!")
    )
    use_case = AIChatUseCase(llm_port=MagicMock(), ai_command_use_case=cmds)
    dto = AIChatDTO(session_id=uuid.uuid4(), natural_language_input="hello")
    seed = use_case._parse_plan(
        '{"action": "core.chat.reply", "effect": "read", '
        '"parameters": {"reply": "Xin chào bạn!"}}',
        dto,
    )
    status, message, result = await use_case._run_react(seed, dto, {"t": "t"})
    assert status == AICommandStatus.COMPLETED
    assert message == "Xin chào bạn!"
    assert result["steps"][0]["result"] == "Xin chào bạn!"


@pytest.mark.asyncio
async def test_plugins_list_returns_markdown():
    from types import SimpleNamespace as _SN
    from unittest.mock import MagicMock as _MM

    from app.core.use_cases.ai_command import AICommandDTO
    from app.core.use_cases.ai_command import (
        AICommandUseCase as _AICommandUseCase,
    )

    plugins = [
        _SN(code_name="hr-module", display_name="HR Core",
            status=_SN(value="ACTIVE")),
    ]
    plugin_repo = _MM()
    plugin_repo.list_installed = AsyncMock(return_value=(plugins, 1))
    uc = _AICommandUseCase(
        plugin_repo=plugin_repo,
        ai_command_repo=_MM(),
        dsl_dry_run_repo=_MM(),
        role_repo=_MM(),
        mattermost_adapter=_MM(),
        n8n_adapter=_MM(),
    )
    dto = AICommandDTO(
        command_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        dsl_version="1.0",
        action="core.plugins.list",
        effect="read",
        parameters={},
    )
    handled, result = await uc._execute_local_read(
        dto, _SN(tenant_id=uuid.uuid4())
    )
    assert handled is True
    assert "HR Core" in result["markdown"]
    assert result["total"] == 1


@pytest.mark.asyncio
async def test_single_step_summary_one_liner():
    from unittest.mock import MagicMock as _MagicMock

    from app.core.domain.entities import AICommandStatus
    from app.core.use_cases.ai_chat import AIChatDTO, AIChatUseCase

    use_case = AIChatUseCase(
        llm_port=_MagicMock(), ai_command_use_case=_MagicMock()
    )
    outcomes = [
        {
            "index": 1,
            "command_id": str(uuid.uuid4()),
            "action": "core.plugins.list",
            "effect": "read",
            "status": AICommandStatus.COMPLETED.value,
            "message": "Lệnh đọc dữ liệu đã thực thi thành công.",
            "result": "danh sách",
        }
    ]
    overall, summary, _ = use_case._summarize(outcomes, 1, [])
    assert overall == AICommandStatus.COMPLETED
    assert "core.plugins.list" in summary
    assert "1." not in summary.split("\n", 1)[0]


@pytest.mark.asyncio
async def test_interactive_actions_have_button_type():
    from unittest.mock import MagicMock

    from app.adapters.external.mattermost_adapter import MattermostAdapter

    captured = {}

    post_response = MagicMock()
    post_response.json.return_value = {"id": "p1"}
    post_response.raise_for_status.return_value = None
    client = AsyncMock()
    client.post.return_value = post_response

    adapter = MattermostAdapter(client=client)
    adapter.token = "t"
    adapter.headers = {}

    async def fake_post(url, headers=None, json=None):
        captured.update(json or {})
        return post_response

    client.post = fake_post
    await adapter.send_interactive_message("chan", "text", "cmd-1")
    actions = captured["props"]["attachments"][0]["actions"]
    assert [a["type"] for a in actions] == ["button", "button"]
    assert [a["id"] for a in actions] == ["approveButton", "rejectButton"]


@pytest.mark.asyncio
async def test_conversation_rejects_unknown_user():
    from unittest.mock import MagicMock

    from app.adapters.repositories.conversation_repo import ConversationRepository

    session = AsyncMock()
    result = MagicMock()
    result.scalar.return_value = None
    session.execute.return_value = result
    repo = ConversationRepository(session)
    with pytest.raises(ValueError):
        await repo.ensure_session(uuid.uuid4(), uuid.uuid4(), None)


@pytest.mark.asyncio
async def test_approver_wildcard_permission_allowed():
    from types import SimpleNamespace
    from unittest.mock import MagicMock

    from app.core.use_cases.ai_command import AICommandUseCase

    use_case = AICommandUseCase(
        plugin_repo=MagicMock(),
        ai_command_repo=MagicMock(),
        dsl_dry_run_repo=MagicMock(),
        role_repo=MagicMock(),
        mattermost_adapter=MagicMock(),
        n8n_adapter=MagicMock(),
    )
    use_case.role_repo.get_user_permissions = AsyncMock(return_value=["*"])
    approver = SimpleNamespace(
        id=uuid.uuid4(), tenant_id=uuid.uuid4(), roles=["general_manager"],
        is_active=True,
    )
    cmd = {"action": "hr.wf_leave_request", "effect": "write",
           "issued_by_user_id": str(uuid.uuid4())}
    allowed, reason = await use_case._approver_allowed(cmd, approver)
    assert allowed is True, reason


@pytest.mark.asyncio
async def test_pending_preview_has_real_details():
    from datetime import UTC, datetime, timedelta
    from unittest.mock import MagicMock
    from uuid import uuid4

    from app.core.domain.entities import AICommandStatus
    from app.core.use_cases.ai_chat import AIChatDTO, AIChatUseCase

    cmd_use = MagicMock()
    repo = AsyncMock()
    cmd_use.ai_command_repo = repo
    dl = datetime.now(UTC) + timedelta(minutes=30)
    repo.get_command_by_id = AsyncMock(
        return_value={"approval_deadline": dl}
    )
    use_case = AIChatUseCase(
        llm_port=MagicMock(), ai_command_use_case=cmd_use
    )
    outcomes = [
        {
            "index": 1,
            "command_id": str(uuid4()),
            "action": "hr.leave_requests.batch_approve",
            "effect": "write",
            "status": AICommandStatus.PENDING_APPROVAL.value,
            "message": "chờ duyệt",
            "result": {"affected_count": 3, "preview": []},
            "approval_message": "Duyệt 3 đơn?",
        }
    ]
    preview = await use_case._pending_preview(outcomes)
    assert preview["action"] == "hr.leave_requests.batch_approve"
    assert preview["approval_message"] == "Duyệt 3 đơn?"
    assert preview["approval_deadline"] == dl.isoformat()
    assert preview["dry_run_result"]["affected_count"] == 3


@pytest.mark.asyncio
async def test_cancel_own_command():
    from unittest.mock import MagicMock
    from uuid import uuid4

    from app.core.use_cases.ai_command import AICommandUseCase

    tenant_id, requester_id, cmd_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    me = SimpleNamespace(id=requester_id, tenant_id=tenant_id, is_active=True)

    def _use_case(cmd_row):
        uc = AICommandUseCase(
            plugin_repo=MagicMock(),
            ai_command_repo=MagicMock(),
            dsl_dry_run_repo=MagicMock(),
            role_repo=MagicMock(),
            mattermost_adapter=MagicMock(),
            n8n_adapter=MagicMock(),
        )
        uc.ai_command_repo.get_command_by_id = AsyncMock(return_value=cmd_row)
        uc.user_repo = MagicMock()
        uc.user_repo.get = AsyncMock(return_value=me)
        return uc

    base = {
        "id": cmd_id,
        "tenant_id": tenant_id,
        "issued_by_user_id": requester_id,
        "status": "PENDING_APPROVAL",
        "effect": "write",
        "action": "hr.leave_requests.batch_approve",
        "parameters": {},
    }
    uc = _use_case(dict(base))
    assert await uc.cancel_own_command(str(cmd_id), str(requester_id)) == "cancelled"
    uc.ai_command_repo.update_command_approval.assert_called_once()

    uc2 = _use_case(dict(base, status="APPROVED"))
    assert await uc2.cancel_own_command(str(cmd_id), str(requester_id)) == "invalid"

    stranger = SimpleNamespace(
        id=uuid.uuid4(), tenant_id=tenant_id, is_active=True
    )
    uc3 = _use_case(dict(base))
    uc3.user_repo.get = AsyncMock(return_value=stranger)
    uc3.role_repo.get_user_permissions = AsyncMock(return_value=[])
    assert await uc3.cancel_own_command(str(cmd_id), str(stranger.id)) == "denied"

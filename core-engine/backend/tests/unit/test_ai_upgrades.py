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

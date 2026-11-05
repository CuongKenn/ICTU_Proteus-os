# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Regression tests cho #684: Server-side derive AI effect, chống bypass approval."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.domain.entities import AICommandStatus, PluginStatus, TenantContext
from app.core.use_cases.action_catalog import derive_action_effect
from app.core.use_cases.ai_command import AICommandDTO, AICommandUseCase
from app.core.use_cases.dsl_validator import (
    DSLInvalidParametersError,
    DSLPermissionDeniedError,
    DSLValidator,
)


def test_derive_action_effect_catalog():
    # Core actions
    assert derive_action_effect("core.chat.reply") == "read"
    assert derive_action_effect("core.plugins.list") == "read"
    assert derive_action_effect("core.plugins.install") == "write"
    assert derive_action_effect("core.users.deactivate") == "critical"

    # 3-part actions
    assert derive_action_effect("hr.leave_requests.batch_approve") == "write"
    assert derive_action_effect("hr.employees.read") == "read"
    assert derive_action_effect("core.users.delete") == "critical"

    # 2-part workflow actions
    assert derive_action_effect("hr.wf_leave_request") == "write"
    assert derive_action_effect("hr.wf_hr_employees_read") == "read"


@pytest.fixture
def mock_plugin_repo():
    repo = AsyncMock()
    repo.get_tenant_plugin_status_by_code.return_value = PluginStatus.ACTIVE
    return repo


@pytest.fixture
def mock_role_repo():
    repo = AsyncMock()
    repo.get_user_permissions.return_value = [
        "hr:leave_requests:batch_approve",
        "hr:employees:read",
        "hr:leave_requests:read",
        "hr:leave_requests:write",
    ]
    return repo


@pytest.fixture
def mock_manifest_parser():
    parser = MagicMock()
    parser.parse.return_value = SimpleNamespace(
        workflows=[
            SimpleNamespace(
                id="wf_leave_request",
                file="workflows/leave_request.json",
                trigger="webhook",
            ),
            SimpleNamespace(
                id="wf_hr_employees_read",
                file="workflows/hr_employees_read.json",
                trigger="webhook",
            ),
        ]
    )
    return parser


@pytest.fixture
def validator(mock_plugin_repo, mock_role_repo, mock_manifest_parser):
    return DSLValidator(
        plugin_repo=mock_plugin_repo,
        role_repo=mock_role_repo,
        tenant_id="t1",
        user_id=str(uuid.uuid4()),
        manifest_parser=mock_manifest_parser,
    )


@pytest.mark.asyncio
async def test_3part_action_write_with_effect_read_rejected(validator):
    """Client khai báo effect=read cho batch_approve (write) phải bị reject."""
    payload = {
        "dsl_version": "1.0",
        "action": "hr.leave_requests.batch_approve",
        "effect": "read",  # Cố tình bypass approval
        "parameters": {"request_ids": ["r1"]},
    }
    with pytest.raises(
        DSLInvalidParametersError, match="Action .* là hành động 'write'"
    ):
        await validator.validate(payload)


@pytest.mark.asyncio
async def test_3part_action_omitted_effect_derived_automatically(validator):
    """Khi client không gửi effect, server tự derive effect=write."""
    payload = {
        "dsl_version": "1.0",
        "action": "hr.leave_requests.batch_approve",
        "parameters": {"request_ids": ["r1"]},
    }
    result = await validator.validate(payload)
    assert result is True
    assert payload["effect"] == "write"


@pytest.mark.asyncio
async def test_2part_action_write_with_effect_read_rejected(validator):
    """Client khai báo effect=read cho workflow write phải bị reject."""
    payload = {
        "dsl_version": "1.0",
        "action": "hr.wf_leave_request",
        "effect": "read",  # Cố tình bypass approval
        "parameters": {},
    }
    with pytest.raises(
        DSLInvalidParametersError, match="Action .* là hành động 'write'"
    ):
        await validator.validate(payload)


@pytest.mark.asyncio
async def test_2part_action_read_only_user_cannot_call_write_workflow(
    mock_plugin_repo, mock_manifest_parser
):
    """User chỉ có quyền read không được gọi workflow write (hr.wf_leave_request)."""
    read_only_role_repo = AsyncMock()
    read_only_role_repo.get_user_permissions.return_value = ["hr:employees:read"]

    val = DSLValidator(
        plugin_repo=mock_plugin_repo,
        role_repo=read_only_role_repo,
        tenant_id="t1",
        user_id=str(uuid.uuid4()),
        manifest_parser=mock_manifest_parser,
    )
    payload = {
        "dsl_version": "1.0",
        "action": "hr.wf_leave_request",
        "parameters": {},
    }
    with pytest.raises(DSLPermissionDeniedError, match="chỉ có quyền đọc"):
        await val.validate(payload)


@pytest.mark.asyncio
async def test_ai_command_use_case_rejects_client_bypass_effect():
    """AICommandUseCase trả FAILED khi client cố bypass bằng effect=read."""
    ctx = TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["hr_manager"],
        email="test@example.com",
    )
    cmd_repo = AsyncMock()
    dry_run_repo = AsyncMock()
    plugin_repo = AsyncMock()
    plugin_repo.get_tenant_plugin_status_by_code.return_value = PluginStatus.ACTIVE
    role_repo = AsyncMock()
    role_repo.get_user_permissions.return_value = ["hr:leave_requests:batch_approve"]
    mattermost = AsyncMock()
    n8n = AsyncMock()

    use_case = AICommandUseCase(
        plugin_repo=plugin_repo,
        ai_command_repo=cmd_repo,
        dsl_dry_run_repo=dry_run_repo,
        role_repo=role_repo,
        mattermost_adapter=mattermost,
        n8n_adapter=n8n,
    )

    req = AICommandDTO(
        command_id=uuid.uuid4(),
        dsl_version="1.0",
        action="hr.leave_requests.batch_approve",
        effect="read",  # Cố tình khai read
        parameters={"request_ids": ["r1"]},
    )

    status, msg, preview = await use_case.execute(req, ctx)
    assert status == AICommandStatus.FAILED
    assert "hành động 'write'" in msg
    n8n.trigger_webhook.assert_not_called()


@pytest.mark.asyncio
async def test_ai_command_use_case_enforces_approval_for_write():
    """AICommandUseCase đưa lệnh write vào PENDING_APPROVAL và gửi Mattermost."""
    ctx = TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["hr_manager"],
        email="test@example.com",
    )
    cmd_repo = AsyncMock()
    dry_run_repo = AsyncMock()
    plugin_repo = AsyncMock()
    plugin_repo.get_tenant_plugin_status_by_code.return_value = PluginStatus.ACTIVE
    role_repo = AsyncMock()
    role_repo.get_user_permissions.return_value = ["hr:leave_requests:batch_approve"]
    mattermost = AsyncMock()
    n8n = AsyncMock()

    use_case = AICommandUseCase(
        plugin_repo=plugin_repo,
        ai_command_repo=cmd_repo,
        dsl_dry_run_repo=dry_run_repo,
        role_repo=role_repo,
        mattermost_adapter=mattermost,
        n8n_adapter=n8n,
    )

    req = AICommandDTO(
        command_id=uuid.uuid4(),
        dsl_version="1.0",
        action="hr.leave_requests.batch_approve",
        effect="write",
        parameters={"request_ids": ["r1"]},
    )

    status, msg, preview = await use_case.execute(req, ctx)
    assert status == AICommandStatus.PENDING_APPROVAL
    n8n.trigger_webhook.assert_not_called()
    mattermost.send_interactive_message.assert_called_once()

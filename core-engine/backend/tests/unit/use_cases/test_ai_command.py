# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.core.domain.entities import AICommandStatus, TenantContext
from app.core.use_cases.ai_command import AICommandDTO, AICommandUseCase


@pytest.fixture
def mock_plugin_repo():
    repo = AsyncMock()
    return repo


@pytest.fixture
def mock_ai_command_repo():
    repo = AsyncMock()
    return repo


@pytest.fixture
def mock_role_repo():
    repo = AsyncMock()
    return repo


@pytest.fixture
def mock_dsl_dry_run_repo():
    repo = AsyncMock()
    repo.execute_dry_run.return_value = {"affected_count": 5, "preview": []}
    return repo


@pytest.fixture
def mock_mattermost_adapter():
    adapter = AsyncMock()
    return adapter


@pytest.fixture
def mock_n8n_adapter():
    adapter = AsyncMock()
    adapter.trigger_webhook.return_value = {"status": "ok"}
    return adapter


@pytest.fixture
def use_case(
    mock_plugin_repo,
    mock_ai_command_repo,
    mock_dsl_dry_run_repo,
    mock_mattermost_adapter,
    mock_n8n_adapter,
    mock_role_repo,
):
    return AICommandUseCase(
        plugin_repo=mock_plugin_repo,
        ai_command_repo=mock_ai_command_repo,
        dsl_dry_run_repo=mock_dsl_dry_run_repo,
        mattermost_adapter=mock_mattermost_adapter,
        n8n_adapter=mock_n8n_adapter,
        role_repo=mock_role_repo,
    )


@pytest.fixture
def tenant_ctx():
    return TenantContext(
        tenant_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        roles=["tenant_admin"],
        email="test@example.com",
        full_name="Test User",
    )


@pytest.mark.asyncio
async def test_execute_read_command(
    use_case, mock_ai_command_repo, mock_n8n_adapter, tenant_ctx
):
    request = AICommandDTO(
        command_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        dsl_version="1.0",
        action="hr.leave_requests.batch_approve",
        effect="read",
        parameters={"request_ids": ["1", "2"]},
    )

    with patch(
        "app.core.use_cases.ai_command.DSLValidator.validate", new_callable=AsyncMock
    ) as mock_validate:
        mock_validate.return_value = True

        status, msg, result = await use_case.execute(request, tenant_ctx)

        assert status == AICommandStatus.COMPLETED
        assert result == {"status": "ok"}
        mock_n8n_adapter.trigger_webhook.assert_called_once()
        mock_ai_command_repo.create_command.assert_called_once()
        call_args_read = mock_ai_command_repo.create_command.call_args[0][0]
        # session_id được persist vào record (schema hiện tại, xem 96c01f3)
        assert call_args_read["session_id"] == request.session_id
        mock_ai_command_repo.commit.assert_called_once()


@pytest.mark.asyncio
async def test_execute_write_command(
    use_case,
    mock_ai_command_repo,
    mock_mattermost_adapter,
    mock_dsl_dry_run_repo,
    tenant_ctx,
):
    request = AICommandDTO(
        command_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        dsl_version="1.0",
        action="hr.leave_requests.batch_approve",
        effect="write",
        parameters={"request_ids": ["1"]},
    )

    with patch(
        "app.core.use_cases.ai_command.DSLValidator.validate", new_callable=AsyncMock
    ) as mock_validate:
        mock_validate.return_value = True

        status, msg, result = await use_case.execute(request, tenant_ctx)

        assert status == AICommandStatus.PENDING_APPROVAL
        assert result.get("affected_count") == 5
        assert result.get("preview") == []
        mock_dsl_dry_run_repo.execute_dry_run.assert_called_once()
        mock_ai_command_repo.create_command.assert_called_once()
        mock_ai_command_repo.commit.assert_called_once()
        # Thông báo phê duyệt dùng interactive message (nút Approve/Reject)
        mock_mattermost_adapter.send_interactive_message.assert_called_once()

        # check deadline is 30 minutes
        call_args = mock_ai_command_repo.create_command.call_args[0][0]
        assert call_args["session_id"] == request.session_id
        assert call_args["status"] == "PENDING_APPROVAL"
        deadline = call_args["approval_deadline"]
        created = call_args["created_at"]
        diff = deadline - created
        assert diff.total_seconds() == 1800  # 30 minutes


@pytest.mark.asyncio
async def test_execute_critical_command(
    use_case, mock_ai_command_repo, mock_mattermost_adapter, tenant_ctx
):
    request = AICommandDTO(
        command_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        dsl_version="1.0",
        action="finance.invoices.create",
        effect="critical",
        parameters={},
    )

    with patch(
        "app.core.use_cases.ai_command.DSLValidator.validate", new_callable=AsyncMock
    ) as mock_validate:
        mock_validate.return_value = True

        status, msg, result = await use_case.execute(request, tenant_ctx)

        assert status == AICommandStatus.PENDING_APPROVAL
        mock_ai_command_repo.create_command.assert_called_once()

        # check deadline is 15 minutes
        call_args = mock_ai_command_repo.create_command.call_args[0][0]
        assert call_args["session_id"] == request.session_id
        assert call_args["status"] == "PENDING_APPROVAL"
        deadline = call_args["approval_deadline"]
        created = call_args["created_at"]
        diff = deadline - created
        assert diff.total_seconds() == 900  # 15 minutes


@pytest.mark.asyncio
async def test_process_approval_write_success(
    use_case, mock_ai_command_repo, mock_n8n_adapter
):
    from types import SimpleNamespace

    tenant_id = uuid.uuid4()
    requester_id = uuid.uuid4()
    approver_id = uuid.uuid4()
    cmd_id = uuid.uuid4()
    use_case.user_repo = AsyncMock()
    use_case.user_repo.get_by_email = AsyncMock(return_value=None)
    approver = SimpleNamespace(
        id=approver_id, tenant_id=tenant_id, roles=[], is_active=True
    )
    use_case.user_repo.get = AsyncMock(return_value=approver)
    use_case.mattermost_adapter.get_user_by_id = AsyncMock(return_value=None)
    use_case.role_repo.get_user_permissions = AsyncMock(
        return_value=["hr:leave_requests:approve"]
    )
    mock_ai_command_repo.get_command_by_id.return_value = {
        "id": cmd_id,
        "tenant_id": tenant_id,
        "issued_by_user_id": requester_id,
        "status": "PENDING_APPROVAL",
        "effect": "write",
        "action": "hr.leave_requests.approve",
        "parameters": {"id": "1"},
        "approved_by_user_id": None,
    }

    result = await use_case.process_approval(cmd_id, str(approver_id), "approve")

    assert result == "approved"
    # Ghi nhận đúng UUID nội bộ của người duyệt
    mock_ai_command_repo.update_command_approval.assert_called_once_with(
        cmd_id=cmd_id, status="APPROVED", approved_by=str(approver_id)
    )
    mock_ai_command_repo.commit.assert_called_once()
    mock_n8n_adapter.trigger_webhook.assert_called_once()


@pytest.mark.asyncio
async def test_process_approval_critical_two_approvers(
    use_case, mock_ai_command_repo, mock_n8n_adapter
):
    from types import SimpleNamespace

    tenant_id = uuid.uuid4()
    requester_id = uuid.uuid4()
    cmd_id = uuid.uuid4()
    approver1_id = uuid.uuid4()
    approver2_id = uuid.uuid4()
    use_case.user_repo = AsyncMock()
    use_case.user_repo.get_by_email = AsyncMock(return_value=None)
    use_case.mattermost_adapter.get_user_by_id = AsyncMock(return_value=None)

    def _approver(uid):
        return SimpleNamespace(id=uid, tenant_id=tenant_id, roles=[], is_active=True)

    use_case.role_repo.get_user_permissions = AsyncMock(
        return_value=["finance:invoices:create"]
    )

    # Step 1: First approver (chưa có approved_by) → ghi nhận, chưa chạy n8n
    use_case.user_repo.get = AsyncMock(return_value=_approver(approver1_id))
    mock_ai_command_repo.get_command_by_id.return_value = {
        "id": cmd_id,
        "tenant_id": tenant_id,
        "issued_by_user_id": requester_id,
        "status": "PENDING_APPROVAL",
        "effect": "critical",
        "action": "finance.invoices.create",
        "parameters": {"amount": 1000},
        "approved_by": None,
    }

    result1 = await use_case.process_approval(cmd_id, str(approver1_id), "approve")
    assert result1 == "approved"
    mock_ai_command_repo.update_command_approval.assert_called_once_with(
        cmd_id=cmd_id, approved_by=str(approver1_id)
    )
    mock_n8n_adapter.trigger_webhook.assert_not_called()

    # Step 1b: CÙNG người duyệt lần 2 → denied (cần 2 người khác nhau)
    mock_ai_command_repo.update_command_approval.reset_mock()
    mock_ai_command_repo.get_command_by_id.return_value = {
        "id": cmd_id,
        "tenant_id": tenant_id,
        "issued_by_user_id": requester_id,
        "status": "PENDING_APPROVAL",
        "effect": "critical",
        "action": "finance.invoices.create",
        "parameters": {"amount": 1000},
        "approved_by": approver1_id,
    }
    result_same = await use_case.process_approval(cmd_id, str(approver1_id), "approve")
    assert result_same == "denied"
    mock_ai_command_repo.update_command_approval.assert_not_called()
    mock_n8n_adapter.trigger_webhook.assert_not_called()

    # Step 2: Second (distinct) approver → APPROVED và chạy n8n.
    use_case.user_repo.get = AsyncMock(return_value=_approver(approver2_id))
    mock_ai_command_repo.update_command_approval.reset_mock()
    mock_ai_command_repo.get_command_by_id.return_value = {
        "id": cmd_id,
        "tenant_id": tenant_id,
        "issued_by_user_id": requester_id,
        "status": "PENDING_APPROVAL",
        "effect": "critical",
        "action": "finance.invoices.create",
        "parameters": {"amount": 1000},
        "approved_by": approver1_id,
    }
    result2 = await use_case.process_approval(cmd_id, str(approver2_id), "approve")
    assert result2 == "approved"
    mock_ai_command_repo.update_command_approval.assert_called_once_with(
        cmd_id=cmd_id, status="APPROVED", second_approver=str(approver2_id)
    )
    mock_n8n_adapter.trigger_webhook.assert_called_once()


@pytest.mark.asyncio
async def test_process_approval_reject(use_case, mock_ai_command_repo):
    from types import SimpleNamespace

    tenant_id = uuid.uuid4()
    requester_id = uuid.uuid4()
    approver_id = uuid.uuid4()
    cmd_id = uuid.uuid4()
    use_case.user_repo = AsyncMock()
    use_case.user_repo.get_by_email = AsyncMock(return_value=None)
    use_case.user_repo.get = AsyncMock(
        return_value=SimpleNamespace(
            id=approver_id, tenant_id=tenant_id, roles=[], is_active=True
        )
    )
    use_case.mattermost_adapter.get_user_by_id = AsyncMock(return_value=None)
    use_case.role_repo.get_user_permissions = AsyncMock(
        return_value=["hr:leave_requests:approve"]
    )
    mock_ai_command_repo.get_command_by_id.return_value = {
        "id": cmd_id,
        "tenant_id": tenant_id,
        "issued_by_user_id": requester_id,
        "status": "PENDING_APPROVAL",
        "effect": "write",
        "action": "hr.leave_requests.approve",
        "parameters": {},
        "approved_by_user_id": None,
    }

    result = await use_case.process_approval(cmd_id, str(approver_id), "reject")
    assert result == "rejected"
    mock_ai_command_repo.update_command_approval.assert_called_once_with(
        cmd_id=cmd_id, status="REJECTED", approved_by=str(approver_id)
    )
    mock_ai_command_repo.commit.assert_called_once()


@pytest.mark.asyncio
async def test_process_approval_denies_stranger_and_self(
    use_case, mock_ai_command_repo, mock_n8n_adapter
):
    from types import SimpleNamespace

    tenant_id = uuid.uuid4()
    requester_id = uuid.uuid4()
    stranger_id = uuid.uuid4()
    cmd_id = uuid.uuid4()
    use_case.user_repo = AsyncMock()
    use_case.user_repo.get_by_email = AsyncMock(return_value=None)
    use_case.mattermost_adapter.get_user_by_id = AsyncMock(return_value=None)

    base_cmd = {
        "id": cmd_id,
        "tenant_id": tenant_id,
        "issued_by_user_id": requester_id,
        "status": "PENDING_APPROVAL",
        "effect": "write",
        "action": "hr.leave_requests.approve",
        "parameters": {},
        "approved_by": None,
    }

    # Người lạ không có quyền → denied, không đụng DB execution
    use_case.user_repo.get = AsyncMock(
        return_value=SimpleNamespace(
            id=stranger_id, tenant_id=tenant_id, roles=[], is_active=True
        )
    )
    use_case.role_repo.get_user_permissions = AsyncMock(return_value=[])
    mock_ai_command_repo.get_command_by_id.return_value = dict(base_cmd)
    assert (
        await use_case.process_approval(cmd_id, str(stranger_id), "approve")
    ) == "denied"
    mock_n8n_adapter.trigger_webhook.assert_not_called()

    # Người ra lệnh tự duyệt → denied
    use_case.user_repo.get = AsyncMock(
        return_value=SimpleNamespace(
            id=requester_id, tenant_id=tenant_id, roles=[], is_active=True
        )
    )
    use_case.role_repo.get_user_permissions = AsyncMock(
        return_value=["hr:leave_requests:approve"]
    )
    mock_ai_command_repo.get_command_by_id.return_value = dict(base_cmd)
    assert (
        await use_case.process_approval(cmd_id, str(requester_id), "approve")
    ) == "denied"
    mock_n8n_adapter.trigger_webhook.assert_not_called()

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock

import pytest

from app.core.domain.entities import AICommandStatus
from app.core.use_cases.ai_timeout_worker import AITimeoutWorker


@pytest.fixture
def mock_ai_command_repo():
    repo = AsyncMock()
    # Mocking expired commands
    repo.get_expired_pending_commands.return_value = [
        {
            "id": uuid.uuid4(),
            "action": "hr.leave_requests.batch_approve",
            "tenant_id": uuid.uuid4(),
            "issued_by_user_id": uuid.uuid4(),
        },
        {
            "id": uuid.uuid4(),
            "action": "finance.invoices.create",
            "tenant_id": uuid.uuid4(),
            "issued_by_user_id": uuid.uuid4(),
        },
    ]
    return repo


@pytest.fixture
def mock_audit_log_repo():
    repo = AsyncMock()
    return repo


@pytest.fixture
def mock_mattermost_adapter():
    adapter = AsyncMock()
    return adapter


@pytest.fixture
def worker(mock_ai_command_repo, mock_audit_log_repo, mock_mattermost_adapter):
    return AITimeoutWorker(
        ai_command_repo=mock_ai_command_repo,
        audit_log_repo=mock_audit_log_repo,
        mattermost_adapter=mock_mattermost_adapter,
    )


@pytest.mark.asyncio
async def test_execute_with_expired_commands(
    worker, mock_ai_command_repo, mock_audit_log_repo, mock_mattermost_adapter
):
    await worker.execute()

    # check if get_expired_pending_commands is called
    mock_ai_command_repo.get_expired_pending_commands.assert_called_once()

    # check if update_status is called twice with TIMEOUT
    assert mock_ai_command_repo.update_status.call_count == 2
    for call in mock_ai_command_repo.update_status.call_args_list:
        assert call[0][1] == AICommandStatus.TIMEOUT

    # check if insert_log is called twice
    assert mock_audit_log_repo.insert_log.call_count == 2
    for call in mock_audit_log_repo.insert_log.call_args_list:
        assert call[1]["actor_type"] == "SYSTEM"
        assert call[1]["action"] == "ai_command.timeout"

    # check if mattermost_adapter.send_message is called twice
    assert mock_mattermost_adapter.send_message.call_count == 2
    for call in mock_mattermost_adapter.send_message.call_args_list:
        assert "tự động hủy" in call[1]["text"]

    # check if commit is called
    mock_ai_command_repo.commit.assert_called_once()


@pytest.mark.asyncio
async def test_execute_no_expired_commands(
    worker, mock_ai_command_repo, mock_audit_log_repo, mock_mattermost_adapter
):
    mock_ai_command_repo.get_expired_pending_commands.return_value = []

    await worker.execute()

    mock_ai_command_repo.get_expired_pending_commands.assert_called_once()
    mock_ai_command_repo.update_status.assert_not_called()
    mock_audit_log_repo.insert_log.assert_not_called()
    mock_mattermost_adapter.send_message.assert_not_called()
    mock_ai_command_repo.commit.assert_not_called()


@pytest.mark.asyncio
async def test_execute_with_error(
    worker, mock_ai_command_repo, mock_audit_log_repo, mock_mattermost_adapter
):
    mock_ai_command_repo.update_status.side_effect = Exception("Test DB error")

    await worker.execute()

    mock_ai_command_repo.get_expired_pending_commands.assert_called_once()
    assert mock_ai_command_repo.update_status.call_count == 1
    mock_audit_log_repo.insert_log.assert_not_called()
    mock_mattermost_adapter.send_message.assert_not_called()
    mock_ai_command_repo.rollback.assert_called_once()
    mock_ai_command_repo.commit.assert_not_called()

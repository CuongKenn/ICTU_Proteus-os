# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.core.domain.entities import AICommandStatus, TenantContext
from app.core.use_cases.ai_command import AICommandUseCase
from app.core.use_cases.ai_command import AICommandDTO


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
        assert "session_id" not in call_args_read
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
        assert result == {"affected_count": 5, "preview": []}
        mock_dsl_dry_run_repo.execute_dry_run.assert_called_once()
        mock_ai_command_repo.create_command.assert_called_once()
        mock_ai_command_repo.commit.assert_called_once()
        mock_mattermost_adapter.send_message.assert_called_once()

        # check deadline is 30 minutes
        call_args = mock_ai_command_repo.create_command.call_args[0][0]
        assert "session_id" not in call_args
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
        assert "session_id" not in call_args
        assert call_args["status"] == "PENDING_APPROVAL"
        deadline = call_args["approval_deadline"]
        created = call_args["created_at"]
        diff = deadline - created
        assert diff.total_seconds() == 900  # 15 minutes

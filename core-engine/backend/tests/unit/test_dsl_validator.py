# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import pytest

from app.core.domain.entities import PluginStatus
from app.core.use_cases.dsl_validator import (
    DSLInvalidActionError,
    DSLInvalidParametersError,
    DSLPluginNotActiveError,
    DSLValidator,
    DSLVersionCompatError,
)


class MockPluginRepo:
    async def get_tenant_plugin_status_by_code(self, tenant_id, plugin_code):
        if plugin_code == "finance" and tenant_id == "t1":
            return None  # Not installed
        elif plugin_code == "finance" and tenant_id == "t_finance":
            return PluginStatus.ACTIVE
        elif plugin_code == "hr":
            return PluginStatus.ACTIVE
        return None


@pytest.fixture
def mock_plugin_repo():
    return MockPluginRepo()


@pytest.fixture
def mock_role_repo():
    from unittest.mock import AsyncMock

    mock = AsyncMock()
    # Allow user 'u1' to have required permissions
    mock.get_user_permissions.return_value = [
        "hr:leave_requests:batch_approve",
        "finance:invoices:create",
    ]
    return mock


@pytest.fixture
def validator(mock_plugin_repo, mock_role_repo):
    return DSLValidator(
        plugin_repo=mock_plugin_repo,
        role_repo=mock_role_repo,
        tenant_id="t1",
        user_id="12345678-1234-5678-1234-567812345678",
    )


@pytest.mark.asyncio
async def test_validate_valid_payload(validator):
    payload = {
        "version": "1.0",
        "action": "hr.leave_requests.batch_approve",
        "parameters": {"request_ids": ["req1", "req2"]},
    }
    result = await validator.validate(payload)
    assert result is True


@pytest.mark.asyncio
async def test_validate_invalid_version(validator):
    payload = {"version": "2.0", "action": "hr.leave_requests.batch_approve"}
    with pytest.raises(DSLVersionCompatError):
        await validator.validate(payload)


@pytest.mark.asyncio
async def test_validate_invalid_action_format(validator):
    payload = {"version": "1.0", "action": "invalid_action"}
    with pytest.raises(DSLInvalidActionError):
        await validator.validate(payload)


@pytest.mark.asyncio
async def test_validate_plugin_not_active(validator):
    payload = {"version": "1.0", "action": "finance.invoices.create"}
    with pytest.raises(DSLPluginNotActiveError):
        await validator.validate(payload)


@pytest.mark.asyncio
async def test_validate_invalid_parameters(validator):
    payload = {
        "version": "1.0",
        "action": "hr.leave_requests.batch_approve",
        "parameters": {"reason": "missing request_ids"},
    }
    with pytest.raises(DSLInvalidParametersError):
        await validator.validate(payload)


@pytest.mark.asyncio
async def test_validate_z3_tenant_mismatch(validator):
    payload = {
        "version": "1.0",
        "action": "hr.leave_requests.batch_approve",
        "tenant_id": "malicious_tenant",
        "parameters": {"request_ids": ["req1"]},
    }
    with pytest.raises(DSLInvalidParametersError) as exc:
        await validator.validate(payload)
    assert "Formal Verification Failed" in str(exc.value)


@pytest.mark.asyncio
async def test_validate_z3_finance_negative_amount(mock_plugin_repo, mock_role_repo):
    validator_finance = DSLValidator(
        plugin_repo=mock_plugin_repo,
        role_repo=mock_role_repo,
        tenant_id="t_finance",
        user_id="12345678-1234-5678-1234-567812345678",
    )
    payload = {
        "version": "1.0",
        "action": "finance.invoices.create",
        "tenant_id": "t_finance",
        "parameters": {"amount": -50.0, "tax_rate": 0.1},
    }
    with pytest.raises(DSLInvalidParametersError) as exc:
        await validator_finance.validate(payload)
    assert "Formal Verification Failed" in str(exc.value)


@pytest.mark.asyncio
async def test_validate_z3_finance_valid(mock_plugin_repo, mock_role_repo):
    validator_finance = DSLValidator(
        plugin_repo=mock_plugin_repo,
        role_repo=mock_role_repo,
        tenant_id="t_finance",
        user_id="12345678-1234-5678-1234-567812345678",
    )
    payload = {
        "version": "1.0",
        "action": "finance.invoices.create",
        "tenant_id": "t_finance",
        "parameters": {"amount": 100.5, "tax_rate": 0.1},
    }
    result = await validator_finance.validate(payload)
    assert result is True

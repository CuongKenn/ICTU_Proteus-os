import pytest

from app.core.domain.entities import PluginStatus
from app.core.use_cases.dsl_validator import (
    DSLInvalidActionError,
    DSLInvalidParametersError,
    DSLPermissionDeniedError,
    DSLPluginNotActiveError,
    DSLValidator,
    DSLVersionCompatError,
)


class MockPluginRepo:
    async def get_tenant_plugin_status_by_code(self, tenant_id, plugin_code):
        if plugin_code == "finance":
            return None  # Not installed
        elif plugin_code == "hr":
            return PluginStatus.ACTIVE
        return None


@pytest.fixture
def mock_plugin_repo():
    return MockPluginRepo()


@pytest.fixture
def validator(mock_plugin_repo):
    return DSLValidator(plugin_repo=mock_plugin_repo, tenant_id="t1", user_id="u1")


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
async def test_validate_action_not_in_whitelist(validator):
    payload = {"version": "1.0", "action": "hr.leave_requests.unknown_method"}
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

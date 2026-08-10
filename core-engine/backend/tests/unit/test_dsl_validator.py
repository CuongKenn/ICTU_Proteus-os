import pytest

from app.core.use_cases.dsl_validator import (
    DSLInvalidActionError,
    DSLInvalidParametersError,
    DSLPermissionDeniedError,
    DSLPluginNotActiveError,
    DSLValidator,
    DSLVersionCompatError,
)


class MockResult:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row


class MockDB:
    async def execute(self, sql, params):
        plugin = params.get("plugin")
        if plugin == "finance":
            return MockResult(None)  # Not installed
        elif plugin == "hr":
            return MockResult(type("obj", (object,), {"status": "ACTIVE"}))
        return MockResult(None)


@pytest.fixture
def mock_db():
    return MockDB()


@pytest.fixture
def validator(mock_db):
    return DSLValidator(db_session=mock_db, tenant_id="t1", user_id="u1")


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

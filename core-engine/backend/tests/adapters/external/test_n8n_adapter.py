import pytest
from unittest.mock import patch, MagicMock
from app.adapters.external.n8n_adapter import N8nAdapter, N8nAdapterError


@pytest.mark.asyncio
async def test_create_credential_success():
    adapter = N8nAdapter()

    # Mock _request_with_retry
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"id": "cred-123"}

    with patch.object(
        adapter, "_request_with_retry", return_value=mock_response
    ) as mock_request:
        result = await adapter.create_credential(
            credential_type="smtp",
            credential_name="tenant_1_smtp",
            data={"user": "admin"},
        )

        assert result == {"id": "cred-123"}
        mock_request.assert_called_once()
        args, kwargs = mock_request.call_args
        assert args[0] == "POST"
        assert kwargs["json"]["type"] == "smtp"
        assert kwargs["json"]["name"] == "tenant_1_smtp"
        assert kwargs["json"]["data"] == {"user": "admin"}


@pytest.mark.asyncio
async def test_create_credential_failure():
    adapter = N8nAdapter()

    # Mock _request_with_retry
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "Bad Request"

    with patch.object(adapter, "_request_with_retry", return_value=mock_response):
        with pytest.raises(N8nAdapterError):
            await adapter.create_credential(
                credential_type="smtp", credential_name="tenant_1_smtp", data={}
            )

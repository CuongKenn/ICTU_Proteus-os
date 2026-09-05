# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock

import httpx
import pytest

from app.adapters.external.n8n_adapter import (
    N8nAdapter,
    N8nAdapterError,
    N8nWorkflowNotFoundError,
)


@pytest.fixture
def mock_client():
    client = AsyncMock(spec=httpx.AsyncClient)
    return client


@pytest.fixture
def adapter(mock_client):
    return N8nAdapter(client=mock_client)


@pytest.mark.asyncio
async def test_import_workflow_success(adapter, mock_client):
    mock_response = httpx.Response(200, json={"id": "wf-123", "name": "Test Workflow"})
    mock_client.request.return_value = mock_response

    workflow_id = await adapter.import_workflow({"name": "Test Workflow"})

    assert workflow_id == "wf-123"
    mock_client.request.assert_called_once()


@pytest.mark.asyncio
async def test_import_workflow_failure(adapter, mock_client):
    mock_response = httpx.Response(400, text="Bad Request")
    mock_client.request.return_value = mock_response

    with pytest.raises(N8nAdapterError, match="HTTP 400"):
        await adapter.import_workflow({"name": "Test Workflow"})


@pytest.mark.asyncio
async def test_retry_on_5xx(adapter, mock_client):
    error_response = httpx.Response(500, text="Internal Server Error")
    success_response = httpx.Response(
        200, json={"id": "wf-123", "name": "Test Workflow"}
    )

    # 2 failures, then 1 success
    mock_client.request.side_effect = [error_response, error_response, success_response]

    workflow_id = await adapter.import_workflow({"name": "Test Workflow"})

    assert workflow_id == "wf-123"
    assert mock_client.request.call_count == 3


@pytest.mark.asyncio
async def test_activate_workflow_not_found(adapter, mock_client):
    mock_client.request.return_value = httpx.Response(404, text="Not Found")

    with pytest.raises(N8nWorkflowNotFoundError):
        await adapter.activate_workflow("invalid-id")


@pytest.mark.asyncio
async def test_trigger_webhook_security(adapter):
    with pytest.raises(N8nAdapterError, match="Security: webhook_url domain"):
        await adapter.trigger_webhook("https://evil.com/webhook", {})

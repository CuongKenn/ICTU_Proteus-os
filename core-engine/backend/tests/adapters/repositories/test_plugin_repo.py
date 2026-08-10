import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock
from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
from app.core.domain.entities import PluginStatus, PluginEntity

@pytest.fixture
def mock_session():
    return AsyncMock()

@pytest.fixture
def repo(mock_session):
    return SQLAlchemyPluginRepository(mock_session)

@pytest.mark.asyncio
async def test_get_by_id_found(repo, mock_session):
    plugin_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_row = {"id": plugin_id, "code_name": "test", "display_name": "Test", "version": "1.0.0"}
    mock_result.mappings().first.return_value = mock_row
    mock_session.execute.return_value = mock_result
    
    plugin = await repo.get_by_id(plugin_id)
    assert plugin is not None
    assert plugin.id == plugin_id
    assert plugin.code_name == "test"

@pytest.mark.asyncio
async def test_get_by_id_not_found(repo, mock_session):
    plugin_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_result.mappings().first.return_value = None
    mock_session.execute.return_value = mock_result
    
    plugin = await repo.get_by_id(plugin_id)
    assert plugin is None

@pytest.mark.asyncio
async def test_list_marketplace(repo, mock_session):
    mock_result = MagicMock()
    mock_row = {"id": uuid.uuid4(), "code_name": "test", "display_name": "Test", "version": "1.0.0"}
    mock_result.mappings.return_value = [mock_row]
    mock_session.execute.return_value = mock_result
    
    plugins = await repo.list_marketplace(limit=10, offset=0)
    assert len(plugins) == 1
    assert plugins[0].code_name == "test"

@pytest.mark.asyncio
async def test_list_installed(repo, mock_session):
    tenant_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_row = {"id": uuid.uuid4(), "code_name": "test", "display_name": "Test", "version": "1.0.0", "status": "ACTIVE"}
    mock_result.mappings.return_value = [mock_row]
    mock_session.execute.return_value = mock_result
    
    plugins = await repo.list_installed(tenant_id)
    assert len(plugins) == 1
    assert plugins[0].status == PluginStatus.ACTIVE

@pytest.mark.asyncio
async def test_get_installation_status_found(repo, mock_session):
    tenant_id = uuid.uuid4()
    plugin_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_result.first.return_value = ("ACTIVE",)
    mock_session.execute.return_value = mock_result
    
    status = await repo.get_installation_status(tenant_id, plugin_id)
    assert status == PluginStatus.ACTIVE

@pytest.mark.asyncio
async def test_get_installation_status_not_found(repo, mock_session):
    tenant_id = uuid.uuid4()
    plugin_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_result.first.return_value = None
    mock_session.execute.return_value = mock_result
    
    status = await repo.get_installation_status(tenant_id, plugin_id)
    assert status is None

@pytest.mark.asyncio
async def test_upsert_installation(repo, mock_session):
    tenant_id = uuid.uuid4()
    plugin_id = uuid.uuid4()
    await repo.upsert_installation(tenant_id, plugin_id, PluginStatus.INSTALLING, "1.0.0")
    assert mock_session.execute.call_count == 1

@pytest.mark.asyncio
async def test_update_status(repo, mock_session):
    tenant_id = uuid.uuid4()
    plugin_id = uuid.uuid4()
    await repo.update_status(tenant_id, plugin_id, PluginStatus.ACTIVE)
    assert mock_session.execute.call_count == 1

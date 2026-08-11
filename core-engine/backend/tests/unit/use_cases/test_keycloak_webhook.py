import uuid
import pytest
from unittest.mock import AsyncMock

from app.core.use_cases.keycloak_webhook import KeycloakWebhookUseCase
from app.core.domain.entities import UserEntity
from app.core.domain.exceptions import NotFoundError


@pytest.fixture
def mock_user_repo():
    return AsyncMock()


@pytest.fixture
def mock_mattermost_adapter():
    return AsyncMock()


@pytest.fixture
def use_case(mock_user_repo, mock_mattermost_adapter):
    return KeycloakWebhookUseCase(
        user_repo=mock_user_repo,
        mattermost_adapter=mock_mattermost_adapter,
    )


@pytest.mark.asyncio
async def test_handle_user_disabled_success(
    use_case, mock_user_repo, mock_mattermost_adapter, monkeypatch
):
    # Setup mock config
    import app.core.use_cases.keycloak_webhook as kw

    monkeypatch.setattr(kw.settings, "MATTERMOST_SYSTEM_CHANNEL_ID", "test-channel")

    keycloak_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_user = UserEntity(
        id=user_id,
        tenant_id=uuid.uuid4(),
        keycloak_id=keycloak_id,
        email="test@example.com",
        full_name="Test User",
        roles=[],
        is_active=True,
    )

    mock_user_repo.get_by_keycloak_id.return_value = mock_user

    await use_case.handle_user_disabled(keycloak_id)

    mock_user_repo.get_by_keycloak_id.assert_called_once_with(keycloak_id)
    mock_user_repo.deactivate.assert_called_once_with(user_id)
    mock_user_repo.commit.assert_called_once()
    mock_mattermost_adapter.send_message.assert_called_once()

    # Verify the message contains user name and email
    called_msg = mock_mattermost_adapter.send_message.call_args[0][1]
    assert "Test User" in called_msg
    assert "test@example.com" in called_msg


@pytest.mark.asyncio
async def test_handle_user_disabled_user_not_found(
    use_case, mock_user_repo, mock_mattermost_adapter, monkeypatch
):
    import app.core.use_cases.keycloak_webhook as kw

    monkeypatch.setattr(kw.settings, "MATTERMOST_SYSTEM_CHANNEL_ID", "test-channel")
    keycloak_id = uuid.uuid4()

    mock_user_repo.get_by_keycloak_id.return_value = None

    await use_case.handle_user_disabled(keycloak_id)

    mock_user_repo.get_by_keycloak_id.assert_called_once_with(keycloak_id)
    mock_user_repo.deactivate.assert_not_called()
    mock_mattermost_adapter.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_handle_user_disabled_already_deactivated(
    use_case, mock_user_repo, mock_mattermost_adapter, monkeypatch
):
    import app.core.use_cases.keycloak_webhook as kw

    monkeypatch.setattr(kw.settings, "MATTERMOST_SYSTEM_CHANNEL_ID", "test-channel")
    keycloak_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_user = UserEntity(
        id=user_id,
        tenant_id=uuid.uuid4(),
        keycloak_id=keycloak_id,
        email="test@example.com",
        full_name="Test User",
        roles=[],
        is_active=False,  # Already inactive
    )

    mock_user_repo.get_by_keycloak_id.return_value = mock_user
    mock_user_repo.deactivate.side_effect = NotFoundError("User already deactivated")

    await use_case.handle_user_disabled(keycloak_id)

    mock_user_repo.deactivate.assert_called_once_with(user_id)
    mock_user_repo.commit.assert_not_called()
    # We still notify that Keycloak asked to deactivate
    mock_mattermost_adapter.send_message.assert_called_once()

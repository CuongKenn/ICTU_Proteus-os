# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
import uuid

from app.adapters.repositories.base import AbstractUserRepository
from app.core.domain.exceptions import NotFoundError
from app.core.domain.ports import AbstractChatOpsPort
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class KeycloakWebhookUseCase:
    """
    Use Case: Xử lý Webhook từ Keycloak.
    """

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        mattermost_adapter: AbstractChatOpsPort,
    ):
        self.user_repo = user_repo
        self.mattermost_adapter = mattermost_adapter

    async def handle_user_disabled(self, keycloak_user_id: uuid.UUID) -> None:
        """
        Xử lý sự kiện user bị vô hiệu hóa trên Keycloak.
        Thực hiện soft delete trong DB và thông báo qua Mattermost.
        """
        logger.info("Processing USER_DISABLED event for %s", keycloak_user_id)

        # 1. Tìm user trong DB
        user = await self.user_repo.get_by_keycloak_id(keycloak_user_id)
        if not user:
            logger.warning(
                "User with keycloak_id %s not found in DB. Skipping.", keycloak_user_id
            )
            return

        # 2. Soft delete user
        try:
            await self.user_repo.deactivate(user.id)
            await self.user_repo.commit()
            logger.info("Successfully deactivated user %s", user.id)
        except NotFoundError:
            logger.warning("User %s already deactivated.", user.id)
        except Exception as e:
            logger.error("Failed to deactivate user %s: %s", user.id, e)
            raise

        # 3. Gửi thông báo Mattermost
        channel_id = settings.MATTERMOST_SYSTEM_CHANNEL_ID
        if channel_id:
            msg = (
                f"**Bảo mật:** Đã vô hiệu hóa tài khoản {user.full_name} "
                f"(`{user.email}`) theo yêu cầu từ hệ thống SSO (Keycloak)."
            )
            await self.mattermost_adapter.send_message(channel_id, msg)

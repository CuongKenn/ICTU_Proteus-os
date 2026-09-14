# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.use_cases.keycloak_webhook import KeycloakWebhookUseCase
from app.entrypoints.dependencies import get_keycloak_webhook_use_case
from app.entrypoints.schemas.keycloak import KeycloakEventSchema
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/keycloak", tags=["Webhooks"])


@router.post(
    "/events",
    status_code=status.HTTP_200_OK,
    summary="Nhận webhook từ Keycloak",
    description=(
        "Xử lý các event từ Keycloak (ví dụ: USER_DISABLED). "
        "Yêu cầu Bearer token xác thực."
    ),
)
async def handle_keycloak_event(
    event: KeycloakEventSchema,
    authorization: str = Header(None),
    use_case: KeycloakWebhookUseCase = Depends(get_keycloak_webhook_use_case),
):
    # C7: fail-closed — secret rỗng thì từ chối mọi event (không so sánh
    # chuỗi rỗng với rỗng = bypass).
    if not settings.KEYCLOAK_WEBHOOK_SECRET:
        logger.error("KEYCLOAK_WEBHOOK_SECRET chưa cấu hình — từ chối webhook.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Webhook chưa được cấu hình.",
        )
    # Xác thực token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing or invalid Authorization header",
        )

    token = authorization.split(" ")[1]
    if not secrets.compare_digest(token, settings.KEYCLOAK_WEBHOOK_SECRET):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid webhook secret",
        )

    # Xử lý event
    logger.info("Received Keycloak event: %s for user %s", event.type, event.user_id)
    if event.type in ["USER_DISABLED", "user.disabled", "DELETE"]:
        await use_case.handle_user_disabled(event.user_id)

    return {"status": "ok"}

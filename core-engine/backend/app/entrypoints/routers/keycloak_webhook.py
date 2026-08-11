# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging

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
    # Xác thực token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    token = authorization.split(" ")[1]
    if token != settings.KEYCLOAK_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret",
        )

    # Xử lý event
    logger.info(f"Received Keycloak event: {event.type} for user {event.user_id}")
    if event.type in ["USER_DISABLED", "user.disabled", "DELETE"]:
        await use_case.handle_user_disabled(event.user_id)

    return {"status": "ok"}

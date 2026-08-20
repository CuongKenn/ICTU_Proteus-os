# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import hashlib
import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractAuditLogRepository
from app.core.use_cases.ai_command import AICommandUseCase
from app.entrypoints.dependencies import (
    get_ai_command_use_case,
    get_audit_log_repo,
    get_db_transactional,
)
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/mattermost", tags=["Webhooks"])


class InteractiveContext(BaseModel):
    action_id: str
    action: str


class MattermostCallbackPayload(BaseModel):
    user_id: str
    context: InteractiveContext
    # Other fields may exist in mattermost payload

    model_config = {"extra": "allow"}


def verify_mattermost_signature(raw_body: bytes, signature: str) -> bool:
    """Xác thực chữ ký HMAC-SHA256 từ Mattermost"""
    if not signature or not settings.MATTERMOST_WEBHOOK_SECRET:
        return False

    expected_hmac = hmac.new(
        settings.MATTERMOST_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()

    # Đôi khi Mattermost có thể không cần HMAC nếu webhook_secret rỗng ở môi trường dev,
    # nhưng theo AC thì bắt buộc phải verify.
    return hmac.compare_digest(expected_hmac, signature)


@router.post("/callback", status_code=status.HTTP_200_OK)
async def mattermost_interactive_callback(
    request: Request,
    mattermost_signature: str = Header(None, alias="Mattermost-Signature"),
    ai_command_use_case: AICommandUseCase = Depends(
        get_ai_command_use_case
    ),  # noqa: B008
    audit_log_repo: AbstractAuditLogRepository = Depends(
        get_audit_log_repo
    ),  # noqa: B008
    db: AsyncSession = Depends(get_db_transactional),  # noqa: B008
):
    """
    Webhook nhận callback từ Mattermost Interactive Message.
    """
    raw_body = await request.body()

    # 1. Verify Signature
    if settings.MATTERMOST_WEBHOOK_SECRET:
        if not mattermost_signature or not verify_mattermost_signature(
            raw_body, mattermost_signature
        ):
            logger.warning("Invalid Mattermost signature")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chữ ký HMAC không hợp lệ",
            )

    # 2. Parse payload
    try:
        payload_dict = await request.json()
        payload = MattermostCallbackPayload(**payload_dict)
    except Exception as e:
        logger.error("Error parsing mattermost payload: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Payload không hợp lệ"
        ) from e

    # 3. Handle Action (Mock logic for now, will integrate with Use Case later)
    action_id = payload.context.action_id
    action = payload.context.action
    user_id = payload.user_id

    # The user_id from Mattermost payload is Mattermost's internal user id,
    # but in our context it acts as the approver_id.
    import json
    import uuid

    if action == "approve":
        logger.info(
            f"Yêu cầu {action_id} được PHÊ DUYỆT bởi user {user_id}. Kích hoạt n8n."
        )
        cmd = await ai_command_use_case.ai_command_repo.get_command_by_id(uuid.UUID(action_id))
        success = await ai_command_use_case.process_approval(
            cmd_id=action_id, approver_id=user_id, action_taken="approve"
        )
        if success and cmd:
            actual_tenant_id = uuid.UUID(str(cmd["tenant_id"])) if cmd.get("tenant_id") else uuid.UUID(int=0)
            await audit_log_repo.insert_log(
                tenant_id=actual_tenant_id,
                actor_type="mattermost_user",
                action="APPROVE_AI_COMMAND",
                resource_type="ai_command",
                resource_id=(
                    uuid.UUID(action_id) if len(action_id) == 36 else uuid.UUID(int=0)
                ),
                command_id=(
                    uuid.UUID(action_id) if len(action_id) == 36 else uuid.UUID(int=0)
                ),
                metadata_json=json.dumps({"mattermost_user_id": user_id}),
            )
            await db.commit()

        return {"ephemeral_text": f"Bạn đã phê duyệt hành động {action_id}."}
    elif action == "reject":
        logger.info(f"Yêu cầu {action_id} BỊ TỪ CHỐI bởi user {user_id}.")
        cmd = await ai_command_use_case.ai_command_repo.get_command_by_id(uuid.UUID(action_id))
        success = await ai_command_use_case.process_approval(
            cmd_id=action_id, approver_id=user_id, action_taken="reject"
        )
        if success and cmd:
            actual_tenant_id = uuid.UUID(str(cmd["tenant_id"])) if cmd.get("tenant_id") else uuid.UUID(int=0)
            await audit_log_repo.insert_log(
                tenant_id=actual_tenant_id,
                actor_type="mattermost_user",
                action="REJECT_AI_COMMAND",
                resource_type="ai_command",
                resource_id=(
                    uuid.UUID(action_id) if len(action_id) == 36 else uuid.UUID(int=0)
                ),
                command_id=(
                    uuid.UUID(action_id) if len(action_id) == 36 else uuid.UUID(int=0)
                ),
                metadata_json=json.dumps({"mattermost_user_id": user_id}),
            )
            await db.commit()

        return {"ephemeral_text": f"Bạn đã từ chối hành động {action_id}."}
    else:
        logger.warning("Unknown action %s from mattermost", action)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Action không hợp lệ"
        )

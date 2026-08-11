# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import hashlib
import hmac
import logging

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel

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
        logger.error(f"Error parsing mattermost payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Payload không hợp lệ"
        )

    # 3. Handle Action (Mock logic for now, will integrate with AI Command Use Case later)
    action_id = payload.context.action_id
    action = payload.context.action
    user_id = payload.user_id

    if action == "approve":
        logger.info(
            f"Yêu cầu {action_id} được PHÊ DUYỆT bởi user {user_id}. Kích hoạt n8n execute."
        )
        # TODO: Cập nhật trạng thái lệnh trong DB thành APPROVED
        # TODO: Gọi n8n_adapter.trigger_webhook()
        # TODO: Ghi log vào AUDIT_LOG

        return {"ephemeral_text": f"Bạn đã phê duyệt hành động {action_id}."}
    elif action == "reject":
        logger.info(f"Yêu cầu {action_id} BỊ TỪ CHỐI bởi user {user_id}.")
        # TODO: Cập nhật trạng thái lệnh trong DB thành REJECTED

        return {"ephemeral_text": f"Bạn đã từ chối hành động {action_id}."}
    else:
        logger.warning(f"Unknown action {action} from mattermost")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Action không hợp lệ"
        )

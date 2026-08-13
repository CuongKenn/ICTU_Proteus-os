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


from app.core.use_cases.ai_command import AICommandUseCase
from app.entrypoints.dependencies import get_ai_command_use_case
from fastapi import Depends

@router.post("/callback", status_code=status.HTTP_200_OK)
async def mattermost_interactive_callback(
    request: Request,
    mattermost_signature: str = Header(None, alias="Mattermost-Signature"),
    ai_use_case: AICommandUseCase = Depends(get_ai_command_use_case),
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

    # 3. Handle Action
    action_id = payload.context.action_id
    action = payload.context.action
    user_id = payload.user_id

    if action == "approve":
        logger.info(
            f"Yêu cầu {action_id} được PHÊ DUYỆT bởi user {user_id}. Kích hoạt n8n execute."
        )
        success = await ai_use_case.process_approval(action_id, user_id, "approve")
        if not success:
            return {"ephemeral_text": "Không thể phê duyệt (lệnh không tồn tại hoặc đã xử lý)."}
        
        return {"ephemeral_text": f"Bạn đã phê duyệt hành động {action_id}."}
    elif action == "reject":
        logger.info(f"Yêu cầu {action_id} BỊ TỪ CHỐI bởi user {user_id}.")
        success = await ai_use_case.process_approval(action_id, user_id, "reject")
        if not success:
            return {"ephemeral_text": "Không thể từ chối (lệnh không tồn tại hoặc đã xử lý)."}
            
        return {"ephemeral_text": f"Bạn đã từ chối hành động {action_id}."}
    else:
        logger.warning(f"Unknown action {action} from mattermost")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Action không hợp lệ"
        )

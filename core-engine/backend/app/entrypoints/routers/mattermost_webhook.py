# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import hashlib
import hmac
import logging
import secrets
import time
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.repositories.base import AbstractAuditLogRepository
from app.core.use_cases.ai_command import AICommandUseCase
from app.entrypoints.dependencies import (
    get_ai_command_use_case,
    get_audit_log_repo,
)
from app.infrastructure.config import settings
from app.infrastructure.database import get_db_transactional

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
    """Xác thực chữ ký HMAC-SHA256 từ Mattermost (C8: fail-closed)."""
    # C8: secret rỗng → luôn False (fail-closed, không bypass ở dev).
    if not signature or not settings.MATTERMOST_WEBHOOK_SECRET:
        return False

    expected_hmac = hmac.new(
        settings.MATTERMOST_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()

    # C8: dùng secrets.compare_digest chống timing-attack.
    return secrets.compare_digest(expected_hmac, signature)


def _parse_uuid_or_none(value: str | None) -> uuid.UUID | None:
    """Parse UUID, trả về None nếu sai định dạng (không dùng UUID(int=0)
    vì vi phạm FK tenants/users)."""
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


async def _audit_best_effort(
    audit_log_repo: AbstractAuditLogRepository,
    db: AsyncSession,
    cmd: dict | None,
    action_id: str,
    user_id: str,
    audit_action: str,
    outcome: str,
) -> None:
    """Ghi audit theo schema mới (tenant_id thật hoặc null, status NOT NULL,
    payload JSONB). Lỗi ghi log không được làm fail callback."""
    try:
        tenant_id = None
        if cmd and cmd.get("tenant_id"):
            try:
                tenant_id = uuid.UUID(str(cmd["tenant_id"]))
            except (ValueError, AttributeError, TypeError):
                tenant_id = None
        resource_id = _parse_uuid_or_none(action_id)
        await audit_log_repo.insert_log(
            tenant_id=tenant_id,
            user_id=None,
            actor_type="HUMAN",
            action=audit_action,
            resource_type="AI_COMMAND",
            resource_id=resource_id,
            payload={"mattermost_user_id": user_id, "outcome": outcome},
            status="success",
        )
        await db.commit()
    except Exception as e:
        logger.warning("Ghi audit %s thất bại (best-effort): %s", audit_action, e)


@router.post("/callback", status_code=status.HTTP_200_OK)
async def mattermost_interactive_callback(
    request: Request,
    token: str = None,
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

    # 1. Verify Signature (C8: fail-closed, 403, compare_digest, replay-guard)
    if not settings.MATTERMOST_WEBHOOK_SECRET:
        logger.error("MATTERMOST_WEBHOOK_SECRET chưa cấu hình — từ chối callback.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Webhook chưa được cấu hình.",
        )
    # C8: replay-guard nếu Mattermost gửi timestamp/nonce (best-effort).
    ts_header = request.headers.get("X-MM-Timestamp") or request.headers.get(
        "Mattermost-Timestamp"
    )
    if ts_header:
        try:
            ts = int(str(ts_header).strip())
            if abs(int(time.time()) - ts) > 300:
                logger.warning("Mattermost callback timestamp hết hạn: %s", ts_header)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Callback đã hết hạn (timestamp).",
                )
        except HTTPException:
            raise
        except (ValueError, TypeError):
            logger.warning("Mattermost timestamp không hợp lệ: %s", ts_header)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Timestamp không hợp lệ.",
            )
    is_valid_hmac = mattermost_signature and verify_mattermost_signature(
        raw_body, mattermost_signature
    )
    # Giữ tương thích token query cũ (đã bỏ ở adapter mới) nhưng so sánh
    # bằng compare_digest.
    is_valid_token = bool(token) and secrets.compare_digest(
        str(token), settings.MATTERMOST_WEBHOOK_SECRET
    )

    # C10: HMAC trong integration context (adapter ký action_id.ts, gửi trong
    # body callback thay vì ?token= raw secret). Parse nhẹ body trước để lấy
    # context, verify rồi mới parse strict ở bước 2.
    is_valid_ctx_hmac = False
    if not (is_valid_hmac or is_valid_token):
        try:
            import json as _json

            _raw = _json.loads(raw_body.decode("utf-8") or "{}")
            _ctx = _raw.get("context") or {}
            _sig = _ctx.get("_sig")
            _ts = _ctx.get("_ts")
            _aid = _ctx.get("action_id")
            if _sig and _ts and _aid:
                _age = abs(int(time.time()) - int(str(_ts)))
                # TTL 35 phút bao phủ deadline duyệt write (30p).
                if _age <= 2100:
                    _exp = hmac.new(
                        settings.MATTERMOST_WEBHOOK_SECRET.encode("utf-8"),
                        f"{_aid}.{_ts}".encode("utf-8"),
                        hashlib.sha256,
                    ).hexdigest()
                    is_valid_ctx_hmac = secrets.compare_digest(str(_sig), _exp)
        except Exception:
            is_valid_ctx_hmac = False

    if not (is_valid_hmac or is_valid_token or is_valid_ctx_hmac):
        logger.warning("Invalid Mattermost signature or token")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chữ ký HMAC hoặc Token không hợp lệ",
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

    if _parse_uuid_or_none(action_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="action_id không hợp lệ"
        )

    # The user_id from Mattermost payload is Mattermost's internal user id,
    # but in our context it acts as the approver_id.
    if action == "approve":
        logger.info(
            "Yêu cầu %s được PHÊ DUYỆT bởi user %s. Kích hoạt n8n.", action_id, user_id
        )
        try:
            cmd = await ai_command_use_case.ai_command_repo.get_command_by_id(
                uuid.UUID(action_id)
            )
        except (ValueError, AttributeError, TypeError):
            cmd = None
        try:
            outcome = await ai_command_use_case.process_approval(
                cmd_id=action_id, approver_id=user_id, action_taken="approve"
            )
        except Exception as e:
            logger.error("Trigger n8n sau duyệt thất bại: %s", e)
            return {
                "ephemeral_text": (
                    "⚠️ Lệnh đã được duyệt nhưng kích hoạt thực thi thất bại "
                    f"({e}). Hệ thống đã đánh dấu FAILED, vui lòng thử lại."
                ),
            }
        if outcome == "denied":
            return {
                "ephemeral_text": "⛔ Bạn không có quyền duyệt lệnh này (cần đúng vai trò, không tự duyệt lệnh của mình).",
            }
        if outcome == "invalid":
            return {
                "ephemeral_text": "Lệnh không còn ở trạng thái chờ duyệt (đã xử lý hoặc hết hạn).",
            }
        if outcome == "partially_approved":
            if cmd:
                await _audit_best_effort(
                    audit_log_repo,
                    db,
                    cmd,
                    action_id,
                    user_id,
                    "APPROVE_AI_COMMAND",
                    outcome,
                )
            return {
                "ephemeral_text": (
                    f"✅ Bạn đã duyệt lượt 1 cho {action_id}. "
                    "Lệnh critical cần thêm 1 người duyệt khác."
                ),
                "update": {
                    "message": (
                        f"⏳ Lệnh đã được duyệt lượt 1 bởi <@{user_id}>, "
                        "đang chờ lượt duyệt thứ 2."
                    ),
                    "props": {},
                },
            }
        if outcome == "approved" and cmd:
            # Audit best-effort: lỗi ghi log không được làm fail cả callback.
            await _audit_best_effort(
                audit_log_repo,
                db,
                cmd,
                action_id,
                user_id,
                "APPROVE_AI_COMMAND",
                outcome,
            )

        return {
            "ephemeral_text": f"Bạn đã phê duyệt hành động {action_id}.",
            "update": {
                "message": f"✅ Lệnh đã ĐƯỢC PHÊ DUYỆT bởi <@{user_id}>",
                "props": {},
            },
        }
    elif action == "reject":
        logger.info("Yêu cầu %s BỊ TỪ CHỐI bởi user %s.", action_id, user_id)
        try:
            cmd = await ai_command_use_case.ai_command_repo.get_command_by_id(
                uuid.UUID(action_id)
            )
        except (ValueError, AttributeError, TypeError):
            cmd = None
        outcome = await ai_command_use_case.process_approval(
            cmd_id=action_id, approver_id=user_id, action_taken="reject"
        )
        if outcome == "denied":
            return {
                "ephemeral_text": "⛔ Bạn không có quyền từ chối lệnh này.",
            }
        if outcome == "invalid":
            return {
                "ephemeral_text": "Lệnh không còn ở trạng thái chờ duyệt (đã xử lý hoặc hết hạn).",
            }
        if outcome == "rejected" and cmd:
            # Audit best-effort: lỗi ghi log không được làm fail cả callback.
            await _audit_best_effort(
                audit_log_repo,
                db,
                cmd,
                action_id,
                user_id,
                "REJECT_AI_COMMAND",
                outcome,
            )

        return {
            "ephemeral_text": f"Bạn đã từ chối hành động {action_id}.",
            "update": {
                "message": f"❌ Lệnh đã BỊ TỪ CHỐI bởi <@{user_id}>",
                "props": {},
            },
        }
    else:
        logger.warning("Unknown action %s from mattermost", action)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Action không hợp lệ"
        )

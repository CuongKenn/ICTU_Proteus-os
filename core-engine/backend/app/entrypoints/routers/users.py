# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — Users Router (REST API)
# Quản lý nhân viên trong Tenant: liệt kê, mời qua email, deactivate.

import logging
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.keycloak_adapter import (
    KeycloakAdapter,
    mattermost_numeric_id,
)
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.repositories.tenant_repo import SQLAlchemyTenantRepository
from app.adapters.repositories.user_repo import SQLAlchemyUserRepository
from app.core.domain.entities import TenantContext
from app.core.domain.exceptions import NotFoundError
from app.core.use_cases.tenant_onboarding import ensure_tenant_mattermost_team
from app.infrastructure.config import settings
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_db_transactional,
    get_keycloak_adapter,
    get_mattermost_adapter,
    require_permission,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


# ─── Schemas ─────────────────────────────────────────────────────────────────


class UserResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    keycloak_id: uuid.UUID | None
    email: str
    full_name: str | None
    roles: list[str] = []
    is_active: bool
    # None = chưa từng đăng nhập → frontend hiển thị "Chờ kích hoạt"
    # (phân biệt với "Vô hiệu hóa" dù cùng is_active=False).
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class InviteUserResponse(UserResponse):
    """Kết quả mời nhân viên, kèm trạng thái gửi email.

    Trước đây lỗi gửi mail bị nuốt thành warning trong log nên admin tưởng
    mail đã đi. Giờ API trả rõ để UI cảnh báo và cho gửi lại.
    """

    email_sent: bool = True
    email_warning: str | None = None


class InviteUserRequest(BaseModel):
    email: str
    full_name: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        import re

        pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Email không hợp lệ")
        return v.lower().strip()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _invite_redirect_uri(request: Request) -> str:
    """Dựng redirect_uri cho link trong email mời.

    Ưu tiên X-Forwarded-Proto/Host khi chạy sau reverse proxy/tunnel
    (production dùng https), local dev giữ http.
    """
    host = request.headers.get("x-forwarded-host") or request.headers.get(
        "host", "proteus.local"
    )
    proto = (request.headers.get("x-forwarded-proto") or "").lower()
    if not proto:
        proto = (
            "http"
            if host.startswith(("localhost", "127.", "proteus.local"))
            or host.startswith("192.168.")
            or host.startswith("10.")
            else "https"
        )
    return f"{proto}://{host}/login"


# ─── Endpoints ───────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=list[UserResponse],
    summary="Liệt kê tất cả Users trong Tenant hiện tại",
)
async def list_users(
    context: TenantContext = Depends(get_current_tenant_context),
    db: AsyncSession = Depends(get_db_transactional),
):
    """Chỉ trả về users thuộc Tenant của caller (RLS tự bảo vệ)."""
    user_repo = SQLAlchemyUserRepository(session=db)
    users = await user_repo.list_by_tenant(tenant_id=context.tenant_id)
    return [
        UserResponse(
            id=u.id,
            tenant_id=u.tenant_id,
            keycloak_id=u.keycloak_id,
            email=u.email,
            full_name=u.full_name,
            roles=u.roles,
            is_active=u.is_active,
            last_login_at=u.last_login_at,
        )
        for u in users
    ]


@router.post(
    "/invite",
    response_model=InviteUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Mời nhân viên mới (gửi email đặt mật khẩu)",
    dependencies=[Depends(require_permission("users:invite"))],
)
async def invite_user(
    payload: InviteUserRequest,
    request: Request,
    context: TenantContext = Depends(get_current_tenant_context),
    keycloak: KeycloakAdapter = Depends(get_keycloak_adapter),
    mattermost: MattermostAdapter = Depends(get_mattermost_adapter),
    db: AsyncSession = Depends(get_db_transactional),
):
    """
    Tạo tài khoản mới trên Keycloak (không có mật khẩu), gắn tenant_id attribute,
    sau đó gửi email để nhân viên tự đặt mật khẩu.
    """
    realm = "proteus"
    user_repo = SQLAlchemyUserRepository(session=db)
    tenant_repo = SQLAlchemyTenantRepository(session=db)

    tenant = await tenant_repo.get_by_id(context.tenant_id)
    if not tenant:
        raise HTTPException(status_code=500, detail="Tenant không tồn tại")

    # 1. Tạo user trên Keycloak (enabled nhưng chưa có password — yêu cầu actions)
    name_parts = payload.full_name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    try:
        keycloak_user_id = await keycloak.create_user(
            realm=realm,
            username=payload.email,
            email=payload.email,
            first_name=first_name,
            last_name=last_name,
            attributes={"tenant_id": [str(context.tenant_id)]},
            # Giữ email ở trạng thái chưa xác minh để required action
            # VERIFY_EMAIL trong email mời có ý nghĩa.
            email_verified=False,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email đã được sử dụng trong hệ thống.",
        ) from e

    # 1.5 Gán mattermostId (số ổn định) để Mattermost SSO parse được userinfo.
    # Mattermost đòi claim `id` là int64 ≠ 0; sub UUID string bị lỗi
    # "Could not parse auth data out of gitlab user object".
    try:
        await keycloak.set_user_attributes(
            realm=realm,
            user_id=keycloak_user_id,
            attributes={
                "mattermostId": [str(mattermost_numeric_id(keycloak_user_id))]
            },
        )
    except Exception:
        logger.warning(
            "Không thể gán mattermostId cho user mới",
            extra={"user_id": keycloak_user_id},
        )

    # 2. Gán role mặc định là "user"
    try:
        await keycloak.assign_role_to_user(
            realm=realm, user_id=keycloak_user_id, role_name="user"
        )
    except Exception:
        logger.warning(
            "Không thể gán role mặc định cho user mới",
            extra={"user_id": keycloak_user_id},
        )

    # 2.5 Gán user vào Keycloak Group của Tenant
    try:
        group_name = f"tenant_{tenant.slug}"
        group_id = await keycloak.get_group_by_name(realm, group_name)
        if group_id:
            await keycloak.add_user_to_group(realm, keycloak_user_id, group_id)
        else:
            logger.warning(
                "Không tìm thấy Keycloak group để map user", extra={"group": group_name}
            )
    except Exception as e:
        logger.warning("Lỗi khi map user vào Keycloak group", exc_info=e)

    # 3. Gửi email mời đặt mật khẩu.
    # QUAN TRỌNG: không nuốt lỗi nữa — trả rõ email_sent/email_warning để UI
    # cảnh báo admin (trước đây chỉ logger.warning nên admin tưởng mail đã đi).
    email_sent = True
    email_warning: str | None = None
    try:
        redirect_uri = _invite_redirect_uri(request)
        await keycloak.send_invite_email(
            realm=realm,
            user_id=keycloak_user_id,
            redirect_uri=redirect_uri,
            # BẮT BUỘC: thiếu client_id Keycloak 400 "Client id missing".
            client_id=settings.KEYCLOAK_CLIENT_ID,
        )
    except RuntimeError as e:
        email_sent = False
        email_warning = (
            "Tài khoản đã được tạo nhưng KHÔNG gửi được email mời "
            f"({e}). Hãy cấu hình SMTP rồi dùng nút 'Gửi lại lời mời'."
        )
        logger.warning("Không thể gửi email mời cho %s: %s", payload.email, e)
    except Exception as e:
        email_sent = False
        email_warning = f"Tài khoản đã được tạo nhưng gửi email thất bại ({e})."
        logger.warning("Không thể gửi email mời cho %s: %s", payload.email, e)

    # 4. Lưu user vào DB ở trạng thái CHỜ KÍCH HOẠT (is_active=False).
    # Lần đăng nhập đầu tiên (sync_user_profile) sẽ bật thành True.
    new_user_id = uuid.uuid4()
    user_entity = await user_repo.upsert(
        {
            "id": new_user_id,
            "tenant_id": context.tenant_id,
            "keycloak_id": uuid.UUID(keycloak_user_id),
            "email": payload.email,
            "full_name": payload.full_name,
            "is_active": False,
        }
    )
    await db.commit()

    # 5. Đưa user vào Mattermost team của tenant (best-effort: login chính
    # qua SSO Keycloak, password random này không dùng trực tiếp).
    try:
        team_cfg = await ensure_tenant_mattermost_team(
            tenant_repo, mattermost, context.tenant_id
        )
        username = payload.email.split("@")[0].lower().replace("+", "")
        await mattermost.ensure_user_in_team_by_email(
            team_id=team_cfg["team_id"],
            email=payload.email,
            username=username,
            password=secrets.token_urlsafe(24),
        )
    except Exception as e:
        logger.warning("Không thể đưa user vào Mattermost team: %s", e)

    logger.info(
        "Invited new user",
        extra={
            "email": payload.email,
            "tenant_id": str(context.tenant_id),
            "email_sent": email_sent,
        },
    )

    return InviteUserResponse(
        id=user_entity.id,
        tenant_id=user_entity.tenant_id,
        keycloak_id=user_entity.keycloak_id,
        email=user_entity.email,
        full_name=user_entity.full_name,
        roles=user_entity.roles,
        is_active=user_entity.is_active,
        last_login_at=user_entity.last_login_at,
        email_sent=email_sent,
        email_warning=email_warning,
    )


@router.post(
    "/{user_id}/resend-invite",
    response_model=InviteUserResponse,
    summary="Gửi lại email mời cho nhân viên chưa kích hoạt",
    dependencies=[Depends(require_permission("users:invite"))],
)
async def resend_invite(
    user_id: uuid.UUID,
    request: Request,
    context: TenantContext = Depends(get_current_tenant_context),
    keycloak: KeycloakAdapter = Depends(get_keycloak_adapter),
    db: AsyncSession = Depends(get_db_transactional),
):
    """Gửi lại email đặt mật khẩu (dùng khi lần mời đầu mail fail do SMTP)."""
    user_repo = SQLAlchemyUserRepository(session=db)
    users = await user_repo.list_by_tenant(tenant_id=context.tenant_id)
    target = next((u for u in users if u.id == user_id), None)
    if not target or not target.keycloak_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy nhân viên (có thể đã bị vô hiệu hóa).",
        )
    if target.last_login_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nhân viên đã kích hoạt tài khoản, không cần gửi lại lời mời.",
        )

    email_sent = True
    email_warning: str | None = None
    try:
        redirect_uri = _invite_redirect_uri(request)
        await keycloak.send_invite_email(
            realm="proteus",
            user_id=str(target.keycloak_id),
            redirect_uri=redirect_uri,
            client_id=settings.KEYCLOAK_CLIENT_ID,
        )
    except RuntimeError as e:
        email_sent = False
        email_warning = f"Vẫn chưa gửi được email mời ({e}). Kiểm tra SMTP."
        logger.warning("Gửi lại email mời thất bại cho %s: %s", target.email, e)
    except Exception as e:
        email_sent = False
        email_warning = f"Gửi email thất bại ({e})."
        logger.warning("Gửi lại email mời thất bại cho %s: %s", target.email, e)

    return InviteUserResponse(
        id=target.id,
        tenant_id=target.tenant_id,
        keycloak_id=target.keycloak_id,
        email=target.email,
        full_name=target.full_name,
        roles=target.roles,
        is_active=target.is_active,
        last_login_at=target.last_login_at,
        email_sent=email_sent,
        email_warning=email_warning,
    )


@router.patch(
    "/{user_id}/deactivate",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Vô hiệu hóa tài khoản nhân viên",
    dependencies=[Depends(require_permission("users:deactivate"))],
)
async def deactivate_user(
    user_id: uuid.UUID,
    context: TenantContext = Depends(get_current_tenant_context),
    keycloak: KeycloakAdapter = Depends(get_keycloak_adapter),
    db: AsyncSession = Depends(get_db_transactional),
):
    """
    Soft-delete user trong DB + disable user trên Keycloak.
    Đảm bảo nhân viên nghỉ việc mất quyền truy cập tất cả apps ngay lập tức.
    """
    user_repo = SQLAlchemyUserRepository(session=db)

    # Lấy thông tin user để có keycloak_id
    users = await user_repo.list_by_tenant(tenant_id=context.tenant_id)
    target = next((u for u in users if u.id == user_id), None)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy user."
        )

    # Không cho phép deactivate chính mình
    if target.keycloak_id == context.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể vô hiệu hóa tài khoản của chính mình.",
        )

    # Disable trên Keycloak trước
    if target.keycloak_id:
        try:
            await keycloak.disable_user(
                realm="proteus", user_id=str(target.keycloak_id)
            )
        except Exception as e:
            logger.error(f"Không thể disable user trên Keycloak: {e}")

    # Soft delete trong DB
    try:
        await user_repo.deactivate(user_id=user_id)
        await db.commit()
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e

    logger.info(
        "User deactivated",
        extra={"user_id": str(user_id), "tenant_id": str(context.tenant_id)},
    )

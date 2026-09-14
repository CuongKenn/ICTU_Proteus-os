# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.keycloak_adapter import mattermost_numeric_id
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.repositories.tenant_repo import SQLAlchemyTenantRepository
from app.core.domain.entities import TenantContext
from app.core.use_cases.tenant_onboarding import ensure_tenant_mattermost_team
from app.core.use_cases.user_provisioning import UserProvisioningUseCase
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_db_transactional,
    get_mattermost_adapter,
    get_user_provisioning_use_case,
)
from app.entrypoints.schemas.user import UserProfileResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description=(
        "Lấy thông tin User hiện tại (First Login Provisioning). "
        "Nếu là lần đầu tiên, user sẽ được tự động thêm vào PostgreSQL."
    ),
)
async def get_me(
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: UserProvisioningUseCase = Depends(get_user_provisioning_use_case),
    mattermost: MattermostAdapter = Depends(get_mattermost_adapter),
    db: AsyncSession = Depends(get_db_transactional),
):
    try:
        user_entity = await use_case.sync_user_profile(tenant_context)
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(e)
        ) from e
    # Best-effort: đảm bảo user nằm trong Mattermost team của tenant.
    # Invite-time add hay bị nuốt lỗi (username trùng, MM down...) khiến user
    # SSO lần đầu rơi vào trạng thái "không thuộc tổ chức nào".
    # Chạy lại ở đây (đăng nhập hệ thống luôn trước khi mở chat) để tự chữa.
    try:
        tenant_repo = SQLAlchemyTenantRepository(session=db)
        team_cfg = await ensure_tenant_mattermost_team(
            tenant_repo, mattermost, tenant_context.tenant_id
        )
        email = (tenant_context.email or "").strip()
        if email:
            import re as _re

            # M17: sanitize username MM về ^[a-z0-9._-]+$.
            username = (
                _re.sub(
                    r"[^a-z0-9._-]+",
                    "-",
                    email.split("@")[0].lower(),
                ).strip(".-")[:64].strip(".-")
            )
            if not username:
                username = f"user-{str(tenant_context.user_id)[:8]}"
            await mattermost.ensure_user_in_team_by_email(
                team_id=team_cfg["team_id"],
                email=email,
                username=username,
                password=secrets.token_urlsafe(24),
                auth_service="gitlab",
                auth_data=str(mattermost_numeric_id(str(tenant_context.user_id))),
            )
    except Exception as e:
        logger.warning("Không đảm bảo được MM team cho %s: %s", tenant_context.email, e)
    return user_entity


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Đăng xuất: thu hồi Mattermost sessions của user",
    description=(
        "Frontend gọi trước federated logout (khi NextAuth session còn hạn). "
        "Best-effort: MM down cũng vẫn trả 200 để không chặn logout hệ thống."
    ),
)
async def logout(
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    mattermost: MattermostAdapter = Depends(get_mattermost_adapter),
):
    revoked = False
    try:
        email = (tenant_context.email or "").strip()
        if email:
            user = await mattermost.get_user_by_email(email)
            if user and user.get("id"):
                revoked = await mattermost.revoke_all_sessions(user["id"])
            else:
                revoked = True
        else:
            revoked = True
    except Exception as e:
        logger.warning("Logout MM best-effort thất bại cho %s: %s", tenant_context.email, e)
    return {"revoked": revoked}

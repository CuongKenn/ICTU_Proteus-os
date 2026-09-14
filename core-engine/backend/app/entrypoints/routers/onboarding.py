# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.repositories.tenant_repo import SQLAlchemyTenantRepository
from app.adapters.repositories.user_repo import SQLAlchemyUserRepository
from app.entrypoints.schemas.onboarding_schemas import SignupRequest, SignupResponse
from app.infrastructure.database import get_db_transactional
from app.infrastructure.rate_limiter import limiter


def _check_password_complexity(password: str) -> None:
    """C10: mật khẩu ≥8 ký tự, có hoa + thường + số (khuyến nghị ký tự đặc biệt)."""
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu phải có ít nhất 8 ký tự.",
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu phải có ít nhất 1 chữ hoa.",
        )
    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu phải có ít nhất 1 chữ thường.",
        )
    if not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu phải có ít nhất 1 chữ số.",
        )
from app.use_cases.tenants.onboarding_use_case import (
    OnboardingRequest,
    OnboardingUseCase,
)

router = APIRouter(prefix="/onboarding")


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản (Tenant mới)",
    description="Tạo Tenant mới, cấp phát dữ liệu cơ bản và tạo Admin user trên Keycloak.",
)
@limiter.limit("5/minute")
async def signup(
    request: Request,
    payload: SignupRequest,
    session: AsyncSession = Depends(get_db_transactional),
) -> SignupResponse:
    # C10: password complexity (defense-in-depth cùng schema validator).
    _check_password_complexity(payload.admin_password)
    # Khởi tạo repositories và adapters
    tenant_repo = SQLAlchemyTenantRepository(session=session)
    user_repo = SQLAlchemyUserRepository(session=session)
    # Lấy http_client từ state
    http_client = request.app.state.http_client
    keycloak_adapter = KeycloakAdapter(client=http_client)
    mattermost_adapter = MattermostAdapter(client=http_client)

    use_case = OnboardingUseCase(
        tenant_repo=tenant_repo,
        user_repo=user_repo,
        keycloak_adapter=keycloak_adapter,
        mattermost_adapter=mattermost_adapter,
    )

    req = OnboardingRequest(
        company_name=payload.company_name,
        admin_full_name=payload.admin_full_name,
        admin_email=payload.admin_email,
        admin_password=payload.admin_password,
    )

    try:
        result = await use_case.execute(req)
        return SignupResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        ) from e
    except IntegrityError as e:
        # C10: race slug (DB unique) — 2 signup cùng slug cùng lúc.
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tên tổ chức vừa được đăng ký, vui lòng thử lại.",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Có lỗi xảy ra khi tạo tài khoản. Vui lòng thử lại sau.",
        ) from e

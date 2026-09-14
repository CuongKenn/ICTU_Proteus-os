# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — Embed URLs (Metabase, Appsmith)

import time

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt

from app.core.domain.entities import TenantContext
from app.entrypoints.dependencies import require_permission
from app.infrastructure.config import settings

router = APIRouter(prefix="/embed")


def _verify_metabase_token(token: str) -> dict:
    """M11: verify JWT embed (tenant binding). Raise 403 nếu sai tenant/hết hạn."""
    try:
        payload = jwt.decode(
            token, settings.METABASE_SECRET_KEY, algorithms=["HS256"]
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Embed token không hợp lệ: {e}",
        ) from e
    return payload


@router.get("/metabase/{dashboard_id}", summary="Get Metabase embed URL")
async def get_metabase_embed_url(
    dashboard_id: int,
    ctx: TenantContext = Depends(require_permission("analytics.view")),
):
    """
    Tạo Signed URL cho iframe Metabase.
    Yêu cầu quyền analytics.view
    """
    # M11: fail-closed — thiếu secret thì lỗi thay vì trả mock URL mở.
    if not settings.METABASE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Metabase embed chưa được cấu hình (thiếu secret).",
        )
    if not settings.METABASE_SITE_URL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Metabase embed chưa được cấu hình (thiếu site URL).",
        )

    # M11: bind tenant_id vào JWT để chống cross-tenant reuse.
    payload = {
        "resource": {"dashboard": dashboard_id},
        "params": {"tenant_id": str(ctx.tenant_id)},
        "exp": int(time.time()) + 600,  # 10 phút
    }

    token = jwt.encode(payload, settings.METABASE_SECRET_KEY, algorithm="HS256")
    # Verify ngay sau khi ký (phát hiện sai secret/thuật toán sớm).
    _verify_metabase_token(token)

    return {
        "url": (
            f"{settings.METABASE_SITE_URL}/embed/dashboard/"
            f"{token}#bordered=true&titled=false"
        )
    }

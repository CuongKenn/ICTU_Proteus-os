# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint Router — Embed URLs (Metabase, Appsmith)

import time

from fastapi import APIRouter, Depends
from jose import jwt

from app.core.domain.entities import TenantContext
from app.entrypoints.dependencies import require_permission
from app.infrastructure.config import settings

router = APIRouter(prefix="/embed")


@router.get("/metabase/{dashboard_id}", summary="Get Metabase embed URL")
async def get_metabase_embed_url(
    dashboard_id: int,
    ctx: TenantContext = Depends(require_permission("analytics.view")),
):
    """
    Tạo Signed URL cho iframe Metabase.
    Yêu cầu quyền analytics.view
    """
    if not settings.METABASE_SECRET_KEY or not settings.METABASE_SITE_URL:
        # Fallback for dev if not configured
        return {"url": f"{settings.METABASE_SITE_URL}/embed/dashboard/mock"}

    payload = {
        "resource": {"dashboard": dashboard_id},
        "params": {},
        "exp": int(time.time()) + 600,  # 10 phút
    }

    token = jwt.encode(payload, settings.METABASE_SECRET_KEY, algorithm="HS256")

    return {
        "url": (
            f"{settings.METABASE_SITE_URL}/embed/dashboard/"
            f"{token}#bordered=true&titled=false"
        )
    }

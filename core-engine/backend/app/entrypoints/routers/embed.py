# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import time
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from app.infrastructure.config import settings
from app.core.domain.entities import TenantContext
from app.entrypoints.dependencies import require_permission

router = APIRouter(prefix="/embed")

@router.get("/metabase/{dashboard_id}", summary="Lấy Signed URL cho Metabase Embedding")
async def get_metabase_embed_url(
    dashboard_id: int,
    ctx: TenantContext = Depends(require_permission("analytics.view")),
):
    if not settings.METABASE_EMBEDDING_KEY:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="METABASE_EMBEDDING_KEY chưa được cấu hình.",
        )
    
    payload = {
        "resource": {"dashboard": dashboard_id},
        "params": {},
        "exp": int(time.time()) + 600,  # 10 phút
    }
    token = jwt.encode(payload, settings.METABASE_EMBEDDING_KEY, algorithm="HS256")
    
    site_url = settings.METABASE_URL.rstrip("/")
    return {"url": f"{site_url}/embed/dashboard/{token}#bordered=true&titled=false"}

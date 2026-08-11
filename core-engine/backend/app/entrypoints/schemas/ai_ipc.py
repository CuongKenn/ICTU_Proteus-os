# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from pydantic import BaseModel, Field


class KVCacheTransmitRequest(BaseModel):
    source_agent: str = Field(..., description="Agent gửi (VD: hr-module)")
    target_agent: str = Field(..., description="Agent nhận (VD: finance-module)")
    context_data: str = Field(
        ..., description="Dữ liệu Context Text khổng lồ cần truyền"
    )


class KVCacheTransmitResponse(BaseModel):
    pointer_uuid: uuid.UUID = Field(
        ..., description="Mã tham chiếu (Pointer) của Vector trên Qdrant"
    )
    latency_ms: float = Field(..., description="Độ trễ truyền tải mô phỏng")
    message: str = Field(..., description="Thông báo kết quả")

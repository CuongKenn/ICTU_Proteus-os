# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from typing import Any, Dict

from pydantic import BaseModel, Field


class KeycloakEventSchema(BaseModel):
    """
    Schema đại diện cho payload event nhận từ Keycloak webhook.
    Tùy thuộc vào custom Event Listener của Keycloak, cấu trúc này có thể khác nhau.
    Nhưng tối thiểu cần có 'type' và 'userId' / 'details'.
    """

    type: str = Field(..., description="Loại sự kiện, ví dụ: 'USER_DISABLED'")
    user_id: uuid.UUID = Field(
        ..., alias="userId", description="ID của user trong Keycloak"
    )
    details: Dict[str, Any] = Field(
        default_factory=dict, description="Các metadata khác của event"
    )

    class Config:
        populate_by_name = True

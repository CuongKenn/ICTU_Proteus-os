# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from typing import List
import uuid
from pydantic import BaseModel


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    keycloak_id: uuid.UUID
    email: str
    full_name: str
    roles: List[str]
    is_active: bool

    model_config = {"from_attributes": True}


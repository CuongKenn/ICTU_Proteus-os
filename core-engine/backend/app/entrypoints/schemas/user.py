import uuid
from typing import List

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

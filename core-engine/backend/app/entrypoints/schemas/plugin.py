# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — Pydantic Schemas for Plugin API (Input/Output)
# Dùng để FastAPI tự sinh Swagger documentation

import uuid
from pydantic import BaseModel, Field


class PluginResponse(BaseModel):
    id: uuid.UUID
    code_name: str
    display_name: str
    version: str
    is_official: bool
    status: str | None = None

    model_config = {"from_attributes": True}


class PluginListResponse(BaseModel):
    items: list[PluginResponse]
    total: int


class PluginInstallRequest(BaseModel):
    plugin_id: uuid.UUID = Field(..., description="ID của Plugin muốn cài đặt")

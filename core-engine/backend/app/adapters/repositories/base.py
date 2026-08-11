# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Abstract Repository Interfaces (Ports)
# Đây là phần "Port" của Hexagonal Architecture.
# Use Cases chỉ phụ thuộc vào các interface này, không phụ thuộc implementation.

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from app.core.domain.entities import PluginEntity, PluginStatus, TenantEntity


class AbstractPluginRepository(ABC):
    """Port: Giao tiếp với Plugin data store."""

    @abstractmethod
    async def get_by_id(self, plugin_id: uuid.UUID) -> PluginEntity | None:
        """Lấy Plugin theo ID từ bảng plugins."""
        ...

    @abstractmethod
    async def list_marketplace(
        self, limit: int = 20, offset: int = 0
    ) -> tuple[list[PluginEntity], int]:
        """Liệt kê tất cả Plugin trên Marketplace (không lọc theo Tenant)."""
        ...

    @abstractmethod
    async def list_installed(
        self, tenant_id: uuid.UUID
    ) -> tuple[list[PluginEntity], int]:
        """Liệt kê Plugin đã cài đặt của một Tenant."""
        ...

    @abstractmethod
    async def get_installation_status(
        self, tenant_id: uuid.UUID, plugin_id: uuid.UUID
    ) -> PluginStatus | None:
        """Lấy trạng thái cài đặt. Trả về None nếu chưa cài."""
        ...

    @abstractmethod
    async def upsert_installation(
        self,
        tenant_id: uuid.UUID,
        plugin_id: uuid.UUID,
        status: PluginStatus,
        installed_version: str | None = None,
        error_log: str | None = None,
    ) -> None:
        """Tạo mới hoặc cập nhật bản ghi cài đặt trong bảng tenant_plugins."""
        ...

    @abstractmethod
    async def update_status(
        self,
        tenant_id: uuid.UUID,
        plugin_id: uuid.UUID,
        status: PluginStatus,
        error_log: str | None = None,
    ) -> None:
        """Chỉ cập nhật trạng thái và error_log cho bản ghi đã tồn tại."""
        ...

    @abstractmethod
    async def get_tenant_plugin_status_by_code(
        self, tenant_id: str | uuid.UUID, plugin_code: str
    ) -> PluginStatus | None:
        """Lấy trạng thái cài đặt của plugin theo plugin_code."""
        ...


class AbstractTenantRepository(ABC):
    """Port: Giao tiếp với Tenant data store."""

    @abstractmethod
    async def get_by_id(self, tenant_id: uuid.UUID) -> TenantEntity | None:
        """Lấy Tenant theo ID. Trả về None nếu không tìm thấy."""
        ...

    @abstractmethod
    async def get_by_slug(self, slug: str) -> TenantEntity | None:
        """Lấy Tenant theo slug. Trả về None nếu không tìm thấy."""
        ...

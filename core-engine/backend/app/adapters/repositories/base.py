# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Abstract Repository Interfaces (Ports)
# Đây là phần "Port" của Hexagonal Architecture.
# Use Cases chỉ phụ thuộc vào các interface này,
# không phụ thuộc implementation.

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod

from app.core.domain.entities import (
    AICommandStatus,
    PluginEntity,
    PluginStatus,
    TenantEntity,
    TenantIntegrationEntity,
    UserEntity,
)


class AbstractPluginRepository(ABC):
    """Port: Giao tiếp với Plugin data store."""

    @abstractmethod
    async def get_by_id(self, plugin_id: uuid.UUID) -> PluginEntity | None:
        """Lấy Plugin theo ID từ bảng plugins."""
        ...

    @abstractmethod
    async def get_by_code_name(self, code_name: str) -> PluginEntity | None:
        """Lấy Plugin theo code_name."""
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
    async def get_dirty_installations_older_than(self, hours: int) -> list[dict]:
        """Lấy danh sách các plugin bị lỗi (FAILED_DIRTY) quá thời gian."""
        ...

    @abstractmethod
    async def get_tenant_plugin_status_by_code(
        self, tenant_id: str | uuid.UUID, plugin_code: str
    ) -> PluginStatus | None:
        """Lấy trạng thái cài đặt của plugin theo plugin_code."""
        ...

    @abstractmethod
    async def get_installed_version(
        self, tenant_id: uuid.UUID, plugin_id: uuid.UUID
    ) -> str | None:
        """Lấy phiên bản đang được cài đặt của plugin (nếu có)."""
        ...

    @abstractmethod
    async def get_failed_dirty_plugins(self) -> list[tuple[uuid.UUID, uuid.UUID, str]]:
        """
        Lấy tất cả các plugin đang ở trạng thái FAILED_DIRTY trên tất cả tenant.
        Returns:
            List of tuples: (tenant_id, plugin_id, plugin_code_name)
        """
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

    @abstractmethod
    async def create(self, tenant: TenantEntity) -> TenantEntity:
        """Tạo Tenant mới."""
        ...

    @abstractmethod
    async def update(self, tenant_id: uuid.UUID, data: dict) -> TenantEntity:
        """Cập nhật Tenant."""
        ...

    @abstractmethod
    async def soft_delete(self, tenant_id: uuid.UUID) -> None:
        """Soft delete Tenant."""
        ...

    @abstractmethod
    async def get_integrations(
        self, tenant_id: uuid.UUID
    ) -> list[TenantIntegrationEntity]:
        """Lấy danh sách integrations của Tenant."""
        ...

    @abstractmethod
    async def add_integration(
        self, integration: TenantIntegrationEntity
    ) -> TenantIntegrationEntity:
        """Thêm integration mới cho Tenant."""
        ...


class AbstractUserRepository(ABC):
    """Port: Giao tiếp với User data store."""

    @abstractmethod
    async def get_by_keycloak_id(self, keycloak_id: uuid.UUID) -> UserEntity | None:
        """Lấy User theo keycloak_id."""
        ...

    @abstractmethod
    async def upsert(self, user_data: dict) -> UserEntity:
        """Thêm mới hoặc cập nhật thông tin User dựa vào keycloak_id."""
        ...

    @abstractmethod
    async def deactivate(self, user_id: uuid.UUID) -> None:
        """Soft delete user."""
        ...

    @abstractmethod
    async def list_by_tenant(
        self, tenant_id: uuid.UUID, limit: int = 100, offset: int = 0
    ) -> list[UserEntity]:
        """Liệt kê danh sách users của một tenant cụ thể."""
        ...

    @abstractmethod
    async def commit(self) -> None:
        """Commit transaction."""
        ...


class AbstractAICommandRepository(ABC):
    """Port: Giao tiếp với bảng ai_commands."""

    @abstractmethod
    async def get_pending_commands_expiring_soon(self, minutes: int) -> list[dict]:
        """Lấy các command sắp hết hạn."""
        ...

    @abstractmethod
    async def get_expired_pending_commands(self) -> list[dict]:
        """Lấy các lệnh PENDING_APPROVAL đã quá hạn."""
        ...

    @abstractmethod
    async def update_status(self, cmd_id: uuid.UUID, status: AICommandStatus) -> None:
        """Cập nhật trạng thái của lệnh."""
        ...

    @abstractmethod
    async def create_command(self, command_data: dict) -> uuid.UUID:
        """Tạo một command mới và trả về ID."""
        ...

    @abstractmethod
    async def get_command_by_id(self, cmd_id: uuid.UUID) -> dict | None:
        """Lấy thông tin command."""
        ...

    @abstractmethod
    async def update_command_approval(
        self,
        cmd_id: uuid.UUID,
        status: str | None = None,
        approved_by: str | None = None,
        second_approver: str | None = None,
    ) -> None:
        """Cập nhật thông tin phê duyệt của lệnh."""
        ...

    @abstractmethod
    async def commit(self) -> None:
        """Commit transaction."""
        ...

    @abstractmethod
    async def rollback(self) -> None:
        """Rollback transaction."""
        ...


class AbstractAuditLogRepository(ABC):
    """Port: Giao tiếp với bảng audit_logs."""

    @abstractmethod
    async def insert_log(
        self,
        tenant_id: uuid.UUID,
        actor_type: str,
        action: str,
        resource_type: str,
        resource_id: uuid.UUID,
        command_id: uuid.UUID,
        metadata_json: str,
    ) -> None:
        """Thêm một audit log."""
        ...


class AbstractHRLeaveRepository(ABC):
    """Port: Giao tiếp với bảng hr_leave_requests (của HR Plugin)."""

    @abstractmethod
    async def get_pending_leaves_older_than(self, days: int) -> list[dict] | None:
        """Lấy các đơn xin nghỉ phép chưa duyệt quá hạn."""
        ...


class AbstractDSLDryRunRepository(ABC):
    """Port: Giao tiếp cơ sở dữ liệu để thực hiện Dry Run của DSL."""

    @abstractmethod
    async def execute_dry_run(self, tenant_id: str, target_table: str) -> dict:
        """
        Thực thi dry run, trả về dict chứa affected_count và preview data.
        Ví dụ: {"affected_count": 5, "preview": [...]}
        """
        ...

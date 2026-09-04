# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func


from app.infrastructure.database import Base


class BaseModel(Base):
    """
    Abstract base model containing common columns for all tables.
    """

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """
    Mixin for tables that support soft deletion.
    """

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )


# -----------------------------------------------------------------------------
# Core Identity & Multi-Tenancy
# -----------------------------------------------------------------------------


class TenantModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    keycloak_realm: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True
    )
    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="free")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    users: Mapped[list["UserModel"]] = relationship(
        "UserModel", back_populates="tenant"
    )
    roles: Mapped[list["RoleModel"]] = relationship(
        "RoleModel", back_populates="tenant"
    )
    tenant_plugins: Mapped[list["TenantPluginModel"]] = relationship(
        "TenantPluginModel", back_populates="tenant"
    )
    integrations: Mapped[list["TenantIntegrationModel"]] = relationship(
        "TenantIntegrationModel", back_populates="tenant"
    )


class UserModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "users"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    keycloak_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    tenant: Mapped["TenantModel"] = relationship("TenantModel", back_populates="users")


# -----------------------------------------------------------------------------
# Role-Based Access Control (RBAC)
# -----------------------------------------------------------------------------


class RoleModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "roles"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    plugin_code_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system_role: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    permissions: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    tenant: Mapped[Optional["TenantModel"]] = relationship(
        "TenantModel", back_populates="roles"
    )


class UserRoleModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    granted_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# -----------------------------------------------------------------------------
# Plugin & Marketplace
# -----------------------------------------------------------------------------


class PluginModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "plugins"

    code_name: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    icon_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    manifest_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    author: Mapped[str] = mapped_column(String(255), nullable=False)
    license: Mapped[str] = mapped_column(String(50), nullable=False)
    is_official: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    download_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    tenant_plugins: Mapped[list["TenantPluginModel"]] = relationship(
        "TenantPluginModel", back_populates="plugin"
    )


class TenantPluginModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "tenant_plugins"
    __table_args__ = (
        UniqueConstraint("tenant_id", "plugin_id", name="uq_tenant_plugin"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plugin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("plugins.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    installed_version: Mapped[str] = mapped_column(String(50), nullable=False)
    config_override: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    install_error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    installed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    installed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    tenant: Mapped["TenantModel"] = relationship(
        "TenantModel", back_populates="tenant_plugins"
    )
    plugin: Mapped["PluginModel"] = relationship(
        "PluginModel", back_populates="tenant_plugins"
    )


class TenantIntegrationModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "tenant_integrations"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    tenant: Mapped["TenantModel"] = relationship(
        "TenantModel", back_populates="integrations"
    )


# -----------------------------------------------------------------------------
# Audit & AI Command
# -----------------------------------------------------------------------------


class AuditLogModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "audit_logs"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_type: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)


class AICommandModel(BaseModel, SoftDeleteMixin):
    __tablename__ = "ai_commands"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    issued_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dsl_version: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    effect: Mapped[str] = mapped_column(String(50), nullable=False)
    parameters: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    dry_run_result: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    second_approver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    mattermost_message_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    approval_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    execution_result: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

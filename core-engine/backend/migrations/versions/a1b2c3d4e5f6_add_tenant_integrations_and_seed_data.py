# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
# ruff: noqa: E501, W291

"""Add tenant_integrations and seed data

Revision ID: a1b2c3d4e5f6
Revises: e4a12bcff25e
Create Date: 2026-09-01 12:12:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "e4a12bcff25e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create tenant_integrations table
    op.create_table(
        "tenant_integrations",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_tenant_integrations_deleted_at"),
        "tenant_integrations",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tenant_integrations_id"), "tenant_integrations", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_tenant_integrations_tenant_id"),
        "tenant_integrations",
        ["tenant_id"],
        unique=False,
    )

    # 2. Seed Default Tenant
    # Create the default tenant 'proteus.local'
    op.execute("""
        INSERT INTO tenants (id, name, domain, keycloak_realm, plan, is_active, created_at, updated_at)
        VALUES (
            '00000000-0000-0000-0000-000000000001',
            'Default Tenant',
            'proteus.local',
            'proteus',
            'enterprise',
            true,
            now(),
            now()
        )
        ON CONFLICT (domain) DO NOTHING;
        """)

    # 3. Seed System Roles
    # Create 'Admin' and 'User' roles
    op.execute("""
        INSERT INTO roles (id, tenant_id, name, display_name, description, is_system_role, permissions, created_at, updated_at)
        VALUES 
        (
            '00000000-0000-0000-0000-000000000002',
            NULL,
            'admin',
            'System Administrator',
            'Has full access to all system resources.',
            true,
            '{"*": ["*"]}',
            now(),
            now()
        ),
        (
            '00000000-0000-0000-0000-000000000003',
            NULL,
            'user',
            'Standard User',
            'Has standard access to tenant resources.',
            true,
            '{"plugins": ["read", "use"]}',
            now(),
            now()
        )
        ON CONFLICT (id) DO NOTHING;
        """)


def downgrade() -> None:
    # Remove seed data (optional, generally you might just leave it or delete if id matches)
    op.execute(
        "DELETE FROM roles WHERE id IN ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');"
    )
    op.execute("DELETE FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001';")

    # Drop tenant_integrations table
    op.drop_index(
        op.f("ix_tenant_integrations_tenant_id"), table_name="tenant_integrations"
    )
    op.drop_index(op.f("ix_tenant_integrations_id"), table_name="tenant_integrations")
    op.drop_index(
        op.f("ix_tenant_integrations_deleted_at"), table_name="tenant_integrations"
    )
    op.drop_table("tenant_integrations")

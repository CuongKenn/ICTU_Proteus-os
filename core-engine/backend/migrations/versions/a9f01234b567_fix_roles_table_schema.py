# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Alembic Migration: fix roles table to match ORM model
# - Thêm plugin_code_name (thay thế plugin_id FK)
# - Thêm is_system_role
# - Thêm updated_at, deleted_at (SoftDeleteMixin)
# - Nullable/type corrections

"""fix roles table schema to match ORM model

Revision ID: a9f01234b567
Revises: f8a4b5c6d7e8
Create Date: 2026-09-07 22:27:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a9f01234b567"
down_revision = "f8a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("roles")]
    indexes = [i["name"] for i in inspector.get_indexes("roles")]

    # 1. Thêm plugin_code_name (thay cho plugin_id FK) nếu chưa có
    if "plugin_code_name" not in columns:
        op.add_column(
            "roles", sa.Column("plugin_code_name", sa.String(255), nullable=True)
        )

    # 2. Thêm is_system_role nếu chưa có
    if "is_system_role" not in columns:
        op.add_column(
            "roles",
            sa.Column(
                "is_system_role",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
        )

    # 3. Thêm updated_at nếu chưa có
    if "updated_at" not in columns:
        op.add_column(
            "roles",
            sa.Column(
                "updated_at",
                sa.TIMESTAMP(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )

    # 4. Thêm deleted_at nếu chưa có
    if "deleted_at" not in columns:
        op.add_column(
            "roles",
            sa.Column(
                "deleted_at",
                sa.TIMESTAMP(timezone=True),
                nullable=True,
            ),
        )

    # 5. Sửa kiểu dữ liệu name: varchar(100) → varchar(255)
    op.alter_column(
        "roles",
        "name",
        existing_type=sa.String(100),
        type_=sa.String(255),
        existing_nullable=False,
    )

    # 6. Xóa FK constraint và cột plugin_id nếu còn tồn tại
    if "plugin_id" in columns:
        try:
            op.drop_constraint("roles_plugin_id_fkey", "roles", type_="foreignkey")
        except Exception:
            pass
        op.drop_column("roles", "plugin_id")

    # 7. Tạo index nếu chưa có
    if "ix_roles_plugin_code_name" not in indexes:
        op.create_index("ix_roles_plugin_code_name", "roles", ["plugin_code_name"])
    if "ix_roles_deleted_at" not in indexes:
        op.create_index("ix_roles_deleted_at", "roles", ["deleted_at"])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("roles")]
    indexes = [i["name"] for i in inspector.get_indexes("roles")]

    if "ix_roles_deleted_at" in indexes:
        op.drop_index("ix_roles_deleted_at", table_name="roles")
    if "ix_roles_plugin_code_name" in indexes:
        op.drop_index("ix_roles_plugin_code_name", table_name="roles")
    if "plugin_id" not in columns:
        op.add_column(
            "roles",
            sa.Column("plugin_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        try:
            op.create_foreign_key(
                "roles_plugin_id_fkey",
                "roles",
                "plugins",
                ["plugin_id"],
                ["id"],
                ondelete="CASCADE",
            )
        except Exception:
            pass
    if "deleted_at" in columns:
        op.drop_column("roles", "deleted_at")
    if "updated_at" in columns:
        op.drop_column("roles", "updated_at")
    if "is_system_role" in columns:
        op.drop_column("roles", "is_system_role")
    if "plugin_code_name" in columns:
        op.drop_column("roles", "plugin_code_name")
    op.alter_column(
        "roles",
        "name",
        existing_type=sa.String(255),
        type_=sa.String(100),
        existing_nullable=False,
    )

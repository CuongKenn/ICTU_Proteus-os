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
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a9f01234b567'
down_revision = 'f8a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Thêm các cột còn thiếu vào bảng roles ---

    # 1. Thêm plugin_code_name (thay cho plugin_id FK)
    op.add_column('roles', sa.Column(
        'plugin_code_name', sa.String(255), nullable=True
    ))

    # 2. Thêm is_system_role
    op.add_column('roles', sa.Column(
        'is_system_role', sa.Boolean(), nullable=False,
        server_default=sa.text('false')
    ))

    # 3. Thêm updated_at (từ BaseModel)
    op.add_column('roles', sa.Column(
        'updated_at',
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text('now()')
    ))

    # 4. Thêm deleted_at (từ SoftDeleteMixin)
    op.add_column('roles', sa.Column(
        'deleted_at',
        sa.TIMESTAMP(timezone=True),
        nullable=True
    ))

    # 5. Sửa kiểu dữ liệu name: varchar(100) → varchar(255)
    op.alter_column('roles', 'name',
        existing_type=sa.String(100),
        type_=sa.String(255),
        existing_nullable=False
    )

    # 6. Xóa FK constraint và cột plugin_id (thay bằng plugin_code_name)
    op.drop_constraint('roles_plugin_id_fkey', 'roles', type_='foreignkey')
    op.drop_column('roles', 'plugin_id')

    # 7. Tạo index mới
    op.create_index('ix_roles_plugin_code_name', 'roles', ['plugin_code_name'])
    op.create_index('ix_roles_deleted_at', 'roles', ['deleted_at'])


def downgrade() -> None:
    op.drop_index('ix_roles_deleted_at', table_name='roles')
    op.drop_index('ix_roles_plugin_code_name', table_name='roles')
    op.add_column('roles', sa.Column(
        'plugin_id', postgresql.UUID(as_uuid=True), nullable=True
    ))
    op.create_foreign_key(
        'roles_plugin_id_fkey', 'roles', 'plugins', ['plugin_id'], ['id'],
        ondelete='CASCADE'
    )
    op.drop_column('roles', 'deleted_at')
    op.drop_column('roles', 'updated_at')
    op.drop_column('roles', 'is_system_role')
    op.drop_column('roles', 'plugin_code_name')
    op.alter_column('roles', 'name',
        existing_type=sa.String(255),
        type_=sa.String(100),
        existing_nullable=False
    )

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""plugin upgrade pipeline: UPGRADING status, task id, migration tracking

Revision ID: j4e5f6g7h8i9
Revises: i3d4e5f6g7h8
Create Date: 2026-09-12

- Thêm giá trị 'UPGRADING' cho enum plugin_status (native PG enum).
- Thêm cột upgrade_task_id cho tenant_plugins (poll tiến trình upgrade).
- Bảng plugin_schema_migrations track migration đã chạy theo
  (tenant, plugin, version) + checksum (chống sửa file đã chạy).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "j4e5f6g7h8i9"
down_revision: str | None = "i3d4e5f6g7h8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE không chạy được trong transaction block,
    # nên toàn bộ migration này chạy ở chế độ AUTOCOMMIT (chỉ chứa DDL).
    bind = op.get_bind()
    bind.execution_options(isolation_level="AUTOCOMMIT")
    op.execute("ALTER TYPE plugin_status ADD VALUE IF NOT EXISTS 'UPGRADING'")
    op.add_column(
        "tenant_plugins",
        sa.Column("upgrade_task_id", sa.UUID(), nullable=True),
    )
    op.create_table(
        "plugin_schema_migrations",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("plugin_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column(
            "applied_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint(
            "tenant_id", "plugin_id", "version", name="pk_plugin_schema_migrations"
        ),
    )
    op.create_index(
        "idx_plugin_schema_migrations_tenant_plugin",
        "plugin_schema_migrations",
        ["tenant_id", "plugin_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execution_options(isolation_level="AUTOCOMMIT")
    op.drop_index(
        "idx_plugin_schema_migrations_tenant_plugin",
        table_name="plugin_schema_migrations",
    )
    op.drop_table("plugin_schema_migrations")
    op.drop_column("tenant_plugins", "upgrade_task_id")
    # PG không hỗ trợ xóa giá trị enum (cần recreate type) — bỏ qua trong downgrade.

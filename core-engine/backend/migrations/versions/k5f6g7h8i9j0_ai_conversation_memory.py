# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""AI conversation memory: ai_sessions + ai_messages

Revision ID: k5f6g7h8i9j0
Revises: j4e5f6g7h8i9
Create Date: 2026-09-13

- Lịch sử chat Proteus AI lưu server-side theo (tenant, user) để đa thiết bị
  và không rò rỉ qua localStorage dùng chung.
- Cô lập tenant ở application-layer (WHERE tenant_id) theo convention repo
  (migrations trong dự án chưa dùng RLS policies).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "k5f6g7h8i9j0"
down_revision: str | None = "j4e5f6g7h8i9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_sessions",
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ai_sessions_tenant_id"), "ai_sessions", ["tenant_id"], unique=False
    )
    op.create_index(
        op.f("ix_ai_sessions_user_id"), "ai_sessions", ["user_id"], unique=False
    )

    op.create_table(
        "ai_messages",
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("command_id", sa.UUID(), nullable=True),
        sa.Column("citations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["session_id"], ["ai_sessions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ai_messages_session_id"),
        "ai_messages",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ai_messages_tenant_id"), "ai_messages", ["tenant_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_messages_tenant_id"), table_name="ai_messages")
    op.drop_index(op.f("ix_ai_messages_session_id"), table_name="ai_messages")
    op.drop_table("ai_messages")
    op.drop_index(op.f("ix_ai_sessions_user_id"), table_name="ai_sessions")
    op.drop_index(op.f("ix_ai_sessions_tenant_id"), table_name="ai_sessions")
    op.drop_table("ai_sessions")

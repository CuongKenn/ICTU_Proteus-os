# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""Add plugin enrichment fields: category, tags, screenshots, long_description,
credentials_schema, install_steps_log

Revision ID: f1a2b3c4d5e6
Revises: e4a12bcff25e
Create Date: 2026-09-05

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "f6c34deff27g"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ─── plugins table ────────────────────────────────────────────────
    op.add_column(
        "plugins",
        sa.Column("category", sa.String(length=100), nullable=True, server_default="Utilities"),
    )
    op.add_column(
        "plugins",
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            nullable=True,
            server_default="{}",
        ),
    )
    op.add_column(
        "plugins",
        sa.Column(
            "screenshots",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="[]",
        ),
    )
    op.add_column(
        "plugins",
        sa.Column("long_description", sa.Text(), nullable=True),
    )
    op.add_column(
        "plugins",
        sa.Column(
            "credentials_schema",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="[]",
        ),
    )
    op.add_column(
        "plugins",
        sa.Column("homepage_url", sa.String(length=1024), nullable=True),
    )

    # Index để filter theo category
    op.create_index(
        "ix_plugins_category",
        "plugins",
        ["category"],
        unique=False,
    )

    # ─── tenant_plugins table ─────────────────────────────────────────
    op.add_column(
        "tenant_plugins",
        sa.Column(
            "install_steps_log",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="[]",
        ),
    )
    op.add_column(
        "tenant_plugins",
        sa.Column(
            "credential_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            server_default="[]",
        ),
    )
    """
    credential_ids: list of n8n credential IDs created during install.
    Used for rollback when uninstalling the plugin.
    Format: [{"id": "n8n-cred-id", "name": "tenant_{id}_{name}"}]
    """


def downgrade() -> None:
    # tenant_plugins
    op.drop_column("tenant_plugins", "credential_ids")
    op.drop_column("tenant_plugins", "install_steps_log")

    # plugins
    op.drop_index("ix_plugins_category", table_name="plugins")
    op.drop_column("plugins", "homepage_url")
    op.drop_column("plugins", "credentials_schema")
    op.drop_column("plugins", "long_description")
    op.drop_column("plugins", "screenshots")
    op.drop_column("plugins", "tags")
    op.drop_column("plugins", "category")

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""add domain to tenants

Revision ID: f7a3b4c5d6e7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-06 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f7a3b4c5d6e7"
down_revision: str | None = "f1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add slug column (missing in DB but present in models)
    op.add_column("tenants", sa.Column("slug", sa.String(length=255), nullable=True))
    op.execute("UPDATE tenants SET slug = domain WHERE slug IS NULL")
    op.alter_column("tenants", "slug", nullable=False)
    op.create_unique_constraint("uq_tenants_slug", "tenants", ["slug"])
    op.create_index(op.f("ix_tenants_slug"), "tenants", ["slug"], unique=True)

    # Alter domain column to be nullable=True (as requested by issue)
    op.alter_column(
        "tenants", "domain", existing_type=sa.String(length=255), nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        "tenants", "domain", existing_type=sa.String(length=255), nullable=False
    )
    op.drop_index(op.f("ix_tenants_slug"), table_name="tenants")
    op.drop_constraint("uq_tenants_slug", "tenants", type_="unique")
    op.drop_column("tenants", "slug")

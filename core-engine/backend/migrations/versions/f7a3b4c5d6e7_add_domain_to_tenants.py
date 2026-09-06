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
    op.add_column(
        "tenants", sa.Column("domain", sa.String(length=255), nullable=True)
    )
    op.create_unique_constraint(None, "tenants", ["domain"])
    op.create_index(op.f("ix_tenants_domain"), "tenants", ["domain"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_tenants_domain"), table_name="tenants")
    op.drop_constraint(None, "tenants", type_="unique")
    op.drop_column("tenants", "domain")

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""add notify_channel_id to tenants

Revision ID: f6c34deff27g
Revises: f5b23cdff26f
Create Date: 2026-09-05 15:07:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6c34deff27g"
down_revision: str | None = "f5b23cdff26f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tenants", sa.Column("notify_channel_id", sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("tenants", "notify_channel_id")

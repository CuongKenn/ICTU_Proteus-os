# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""add uq_tenant_plugin unique constraint on tenant_plugins

Revision ID: f5b23cdff26f
Revises: e4a12bcff25e
Create Date: 2026-09-04 21:44:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f5b23cdff26f"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None

depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_tenant_plugin",
        "tenant_plugins",
        ["tenant_id", "plugin_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_tenant_plugin",
        "tenant_plugins",
        type_="unique",
    )

"""add install_task_id to tenant_plugins

Revision ID: f8a4b5c6d7e8
Revises: f7a3b4c5d6e7
Create Date: 2026-09-06 15:42:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f8a4b5c6d7e8"
down_revision: str | None = "f7a3b4c5d6e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tenant_plugins",
        sa.Column("install_task_id", sa.UUID(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenant_plugins", "install_task_id")

# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""fix tenant_plugins trigger: replace update_last_updated_at_column with update_updated_at_column

Revision ID: h2c3d4e5f6g8
Revises: g1b2c3d4e5f7
Create Date: 2026-09-08 01:20:00.000000
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "h2c3d4e5f6g8"
down_revision: Union[str, None] = "g1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Fix trigger: table tenant_plugins still uses old function update_last_updated_at_column()
    # which references NEW.last_updated_at. Replace with update_updated_at_column() (uses NEW.updated_at)
    conn.execute(sa.text(
        "DROP TRIGGER IF EXISTS set_tenant_plugins_updated_at ON tenant_plugins"
    ))
    conn.execute(sa.text(
        "CREATE TRIGGER set_tenant_plugins_updated_at "
        "BEFORE UPDATE ON tenant_plugins "
        "FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "DROP TRIGGER IF EXISTS set_tenant_plugins_updated_at ON tenant_plugins"
    ))
    conn.execute(sa.text(
        "CREATE TRIGGER set_tenant_plugins_updated_at "
        "BEFORE UPDATE ON tenant_plugins "
        "FOR EACH ROW EXECUTE FUNCTION update_last_updated_at_column()"
    ))

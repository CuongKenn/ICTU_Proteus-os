# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""remove unique keycloak_realm

Revision ID: i3d4e5f6g7h8
Revises: h2c3d4e5f6g8
Create Date: 2026-09-08 11:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i3d4e5f6g7h8'
down_revision: Union[str, None] = 'h2c3d4e5f6g8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('tenants_keycloak_realm_key', 'tenants', type_='unique')


def downgrade() -> None:
    op.create_unique_constraint('tenants_keycloak_realm_key', 'tenants', ['keycloak_realm'])

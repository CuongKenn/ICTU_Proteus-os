# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""fix tenant_plugins pk, installed_version not null, stale enum defaults

Revision ID: g1b2c3d4e5f7
Revises: 7a6db0254da0
Create Date: 2026-09-08 01:13:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g1b2c3d4e5f7"
down_revision: Union[str, None] = "7a6db0254da0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Fix 1: Promote tenant_plugins.id to actual PRIMARY KEY
    conn.execute(
        sa.text("UPDATE tenant_plugins SET id = gen_random_uuid() WHERE id IS NULL")
    )
    conn.execute(sa.text("ALTER TABLE tenant_plugins ALTER COLUMN id SET NOT NULL"))

    # Drop composite PK if it still exists
    pk_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_constraint WHERE conname='tenant_plugins_pkey' AND contype='p'"
        )
    ).fetchone()
    if pk_exists:
        conn.execute(
            sa.text("ALTER TABLE tenant_plugins DROP CONSTRAINT tenant_plugins_pkey")
        )

    # Add new PK on id if not exists
    id_pk_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_constraint WHERE conname='tenant_plugins_id_pkey' AND contype='p'"
        )
    ).fetchone()
    if not id_pk_exists:
        conn.execute(
            sa.text(
                "ALTER TABLE tenant_plugins ADD CONSTRAINT tenant_plugins_id_pkey PRIMARY KEY (id)"
            )
        )

    # Fix 2: installed_version NOT NULL
    conn.execute(
        sa.text(
            "UPDATE tenant_plugins SET installed_version = 'unknown' "
            "WHERE installed_version IS NULL OR installed_version = ''"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE tenant_plugins ALTER COLUMN installed_version SET NOT NULL"
        )
    )

    # Fix 3: Fix stale ENUM defaults -> plain text defaults
    conn.execute(
        sa.text(
            "ALTER TABLE tenant_plugins ALTER COLUMN status SET DEFAULT 'INSTALLING'"
        )
    )
    conn.execute(
        sa.text(
            "ALTER TABLE ai_commands ALTER COLUMN status SET DEFAULT 'PENDING_APPROVAL'"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "ALTER TABLE tenant_plugins ALTER COLUMN installed_version DROP NOT NULL"
        )
    )
    conn.execute(sa.text("ALTER TABLE tenant_plugins ALTER COLUMN id DROP NOT NULL"))

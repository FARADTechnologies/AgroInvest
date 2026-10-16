"""Staff accounts with a position and permissions set by the administrator

Adds the STAFF role (İşçi) for accounts the administrator creates in the console, and on
every account a position (vəzifə) and an optional list of permissions. Without a list the
older SPECIALIST and SUPERVISOR roles keep their original rights.

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-16 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLES_OLD = "('INVESTOR', 'ENTREPRENEUR', 'SPECIALIST', 'SUPERVISOR', 'ADMIN')"
ROLES_NEW = "('INVESTOR', 'ENTREPRENEUR', 'SPECIALIST', 'SUPERVISOR', 'STAFF', 'ADMIN')"


def upgrade() -> None:
    op.execute("ALTER TABLE app_user DROP CONSTRAINT ck_app_user_role")
    op.execute(f"ALTER TABLE app_user ADD CONSTRAINT ck_app_user_role CHECK (role IN {ROLES_NEW})")
    op.add_column("app_user", sa.Column("position", sa.String(length=120), nullable=True))
    op.add_column(
        "app_user", sa.Column("permissions", postgresql.ARRAY(sa.String(32)), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("app_user", "permissions")
    op.drop_column("app_user", "position")
    op.execute("UPDATE app_user SET is_active = false, role = 'SPECIALIST' WHERE role = 'STAFF'")
    op.execute("ALTER TABLE app_user DROP CONSTRAINT ck_app_user_role")
    op.execute(f"ALTER TABLE app_user ADD CONSTRAINT ck_app_user_role CHECK (role IN {ROLES_OLD})")

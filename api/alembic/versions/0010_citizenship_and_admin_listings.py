"""Citizenship on the profile; one kind of portal user

A person is either an Azerbaijani citizen (identified by FİN) or a foreign citizen (passport
number and country). Outside users are no longer split into investors and sahibkars: every
account is a portal user (INVESTOR), and only the administrator places listings, so the
remaining sahibkar accounts become portal users. Their listings stay as they are.

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-16 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

IDENTIFIER_OLD = "(type = 'INDIVIDUAL' AND fin IS NOT NULL) OR (type = 'COMPANY' AND voen IS NOT NULL)"
IDENTIFIER_NEW = (
    "(type = 'INDIVIDUAL' AND (fin IS NOT NULL OR passport_no IS NOT NULL))"
    " OR (type = 'COMPANY' AND voen IS NOT NULL)"
)


def upgrade() -> None:
    op.add_column(
        "entrepreneur",
        sa.Column(
            "citizenship",
            sa.Enum(
                "AZ",
                "FOREIGN",
                name="citizenship",
                native_enum=False,
                create_constraint=True,
                length=24,
            ),
            nullable=False,
            server_default="AZ",
        ),
    )
    op.add_column("entrepreneur", sa.Column("passport_no", sa.String(length=20), nullable=True))
    op.add_column(
        "entrepreneur", sa.Column("citizenship_country", sa.String(length=60), nullable=True)
    )
    op.execute("ALTER TABLE entrepreneur DROP CONSTRAINT ck_entrepreneur_identifier_matches_type")
    op.execute(
        "ALTER TABLE entrepreneur ADD CONSTRAINT ck_entrepreneur_identifier_matches_type "
        f"CHECK ({IDENTIFIER_NEW})"
    )
    op.execute("UPDATE app_user SET role = 'INVESTOR' WHERE role = 'ENTREPRENEUR'")


def downgrade() -> None:
    op.execute("ALTER TABLE entrepreneur DROP CONSTRAINT ck_entrepreneur_identifier_matches_type")
    op.execute(
        "ALTER TABLE entrepreneur ADD CONSTRAINT ck_entrepreneur_identifier_matches_type "
        f"CHECK ({IDENTIFIER_OLD}) NOT VALID"  # foreign citizens' profiles may remain
    )
    op.drop_column("entrepreneur", "citizenship_country")
    op.drop_column("entrepreneur", "passport_no")
    op.drop_column("entrepreneur", "citizenship")

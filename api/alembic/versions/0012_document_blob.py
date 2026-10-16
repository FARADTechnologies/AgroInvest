"""Uploaded documents stored in the database

Hosted containers lose their disk on every restart, so the bytes of uploaded documents move
into the table document_blob. Files written to UPLOAD_DIR by earlier versions are imported on
start by the seed step.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-16 21:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "document_blob",
        sa.Column("stored_name", sa.String(length=64), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("stored_name", name=op.f("pk_document_blob")),
    )


def downgrade() -> None:
    op.drop_table("document_blob")

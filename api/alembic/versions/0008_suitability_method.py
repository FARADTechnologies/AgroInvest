"""Suitability method versions (experts' AHP matrices)

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-15 11:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "suitability_method",
        sa.Column("version", sa.String(length=20), nullable=False),
        sa.Column("matrices", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("comment", sa.String(length=500), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by"], ["app_user.id"], name=op.f("fk_suitability_method_created_by_app_user")
        ),
        sa.PrimaryKeyConstraint("version", name=op.f("pk_suitability_method")),
    )
    op.create_index(op.f("ix_suitability_method_active"), "suitability_method", ["active"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_suitability_method_active"), table_name="suitability_method")
    op.drop_table("suitability_method")

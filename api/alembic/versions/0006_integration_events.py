"""EKTIS callbacks: events table, confirmation on the outbox, log direction

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-15 05:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "integration_event",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.String(length=64), nullable=False),
        sa.Column("type", sa.String(length=60), nullable=False),
        sa.Column("decision_id", sa.String(length=64), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_integration_event")),
        sa.UniqueConstraint("event_id", name=op.f("uq_integration_event_event_id")),
    )
    op.add_column("integration_outbox", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("integration_outbox", sa.Column("land_use_right_id", sa.String(length=60), nullable=True))
    op.add_column(
        "integration_log",
        sa.Column("direction", sa.String(length=3), server_default="OUT", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("integration_log", "direction")
    op.drop_column("integration_outbox", "land_use_right_id")
    op.drop_column("integration_outbox", "confirmed_at")
    op.drop_table("integration_event")

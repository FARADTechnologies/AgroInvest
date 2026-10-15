"""Integration outbox and log for EKTIS

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-15 04:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "integration_outbox",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING", "SENT", "FAILED",
                name="outboxstatus", native_enum=False, create_constraint=True, length=24,
            ),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column("ektis_reference", sa.String(length=60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["application_id"], ["application.id"],
            name=op.f("fk_integration_outbox_application_id_application"), ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_integration_outbox")),
    )
    op.create_index(
        op.f("ix_integration_outbox_application_id"), "integration_outbox", ["application_id"], unique=False
    )
    op.create_index(op.f("ix_integration_outbox_status"), "integration_outbox", ["status"], unique=False)
    op.create_table(
        "integration_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("system", sa.String(length=20), nullable=False),
        sa.Column("operation", sa.String(length=60), nullable=False),
        sa.Column("method", sa.String(length=8), nullable=False),
        sa.Column("path", sa.String(length=200), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("ok", sa.Boolean(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(length=64), nullable=False),
        sa.Column("summary", sa.String(length=300), nullable=True),
        sa.Column("error", sa.String(length=300), nullable=True),
        sa.Column("outbox_id", sa.Uuid(), nullable=True),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["app_user.id"], name=op.f("fk_integration_log_actor_id_app_user")
        ),
        sa.ForeignKeyConstraint(
            ["outbox_id"], ["integration_outbox.id"],
            name=op.f("fk_integration_log_outbox_id_integration_outbox"), ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_integration_log")),
    )
    op.create_index(op.f("ix_integration_log_created_at"), "integration_log", ["created_at"], unique=False)
    op.create_index(op.f("ix_integration_log_request_id"), "integration_log", ["request_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_integration_log_request_id"), table_name="integration_log")
    op.drop_index(op.f("ix_integration_log_created_at"), table_name="integration_log")
    op.drop_table("integration_log")
    op.drop_index(op.f("ix_integration_outbox_status"), table_name="integration_outbox")
    op.drop_index(op.f("ix_integration_outbox_application_id"), table_name="integration_outbox")
    op.drop_table("integration_outbox")

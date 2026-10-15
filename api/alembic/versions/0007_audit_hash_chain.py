"""Tamper-evident audit log: append-only, sealed into a SHA-256 hash chain

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-15 05:30:00.000000

Entries are written in the request's transaction as before. A sealer (run by the API's
background worker and before every verification) chains unsealed entries in insertion
order: each entry's hash covers its content and the previous entry's hash, so changing or
deleting a sealed entry breaks the chain from that point. Sealing outside the request
transactions keeps user actions free of a global lock. Updates other than sealing, and
deletes, are refused by a trigger.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("audit_log", sa.Column("chain_seq", sa.BigInteger(), nullable=True))
    op.create_index(op.f("ix_audit_log_chain_seq"), "audit_log", ["chain_seq"], unique=True)
    # asyncpg runs one statement per call, so each statement is executed on its own.
    for statement in UPGRADE:
        op.execute(statement)


UPGRADE = [
    """
    CREATE TABLE audit_chain_head (
        id integer PRIMARY KEY CHECK (id = 1),
        seq bigint NOT NULL,
        hash varchar(64)
    )
    """,
    "INSERT INTO audit_chain_head VALUES (1, 0, NULL)",
    """
    CREATE FUNCTION audit_entry_hash(prev text, a audit_log) RETURNS text
    LANGUAGE sql STABLE AS $$
      SELECT encode(sha256(convert_to(concat_ws('|',
        coalesce(prev, ''), a.chain_seq::text, coalesce(a.actor_id::text, ''),
        coalesce(a.actor_role, ''), a.action, a.entity_type, a.entity_id,
        coalesce(a.details::text, '{}'), coalesce(a.ip, ''),
        to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
      ), 'UTF8')), 'hex')
    $$
    """,
    """
    CREATE FUNCTION seal_audit_log() RETURNS integer
    LANGUAGE plpgsql AS $$
    DECLARE
      head audit_chain_head%ROWTYPE;
      r audit_log%ROWTYPE;
      n integer := 0;
    BEGIN
      SELECT * INTO head FROM audit_chain_head WHERE id = 1 FOR UPDATE;
      FOR r IN SELECT * FROM audit_log WHERE chain_seq IS NULL ORDER BY id FOR UPDATE LOOP
        r.chain_seq := head.seq + 1;
        r.prev_hash := head.hash;
        r.hash := audit_entry_hash(head.hash, r);
        UPDATE audit_log SET chain_seq = r.chain_seq, prev_hash = r.prev_hash, hash = r.hash
          WHERE id = r.id;
        head.seq := r.chain_seq;
        head.hash := r.hash;
        n := n + 1;
      END LOOP;
      UPDATE audit_chain_head SET seq = head.seq, hash = head.hash WHERE id = 1;
      RETURN n;
    END $$
    """,
    """
    CREATE FUNCTION audit_log_append_only() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit_log is append-only';
      END IF;
      -- Only sealing may change a row: once, and only the chain columns.
      IF OLD.chain_seq IS NOT NULL
         OR (OLD.actor_id, OLD.actor_role, OLD.action, OLD.entity_type, OLD.entity_id,
             OLD.details, OLD.ip, OLD.created_at)
            IS DISTINCT FROM
            (NEW.actor_id, NEW.actor_role, NEW.action, NEW.entity_type, NEW.entity_id,
             NEW.details, NEW.ip, NEW.created_at) THEN
        RAISE EXCEPTION 'audit_log is append-only';
      END IF;
      RETURN NEW;
    END $$
    """,
    """
    CREATE TRIGGER trg_audit_log_append_only
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW EXECUTE FUNCTION audit_log_append_only()
    """,
    "SELECT seal_audit_log()",
]


def downgrade() -> None:
    for statement in (
        "DROP TRIGGER trg_audit_log_append_only ON audit_log",
        "DROP FUNCTION audit_log_append_only()",
        "DROP FUNCTION seal_audit_log()",
        "DROP FUNCTION audit_entry_hash(text, audit_log)",
        "DROP TABLE audit_chain_head",
    ):
        op.execute(statement)
    op.drop_index(op.f("ix_audit_log_chain_seq"), table_name="audit_log")
    op.drop_column("audit_log", "chain_seq")

"""Audit log: who may read it, append-only rows and a hash chain that exposes tampering."""

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.db.session import SessionFactory
from app.modules.audit.models import AuditLog

from .conftest import login


async def test_supervisors_read_and_verify_the_audit_log(client):
    await login(client, "rehber@agro-demo.test")
    entries = (await client.get("/api/v1/admin/audit")).json()
    assert entries and {"action", "actor_name", "hash"} <= entries[0].keys()
    check = (await client.get("/api/v1/admin/audit/verify")).json()
    assert check["valid"] is True and check["sealed"] > 0

    await login(client, "mutexessis@agro-demo.test")
    assert (await client.get("/api/v1/admin/audit")).status_code == 403  # the audited do not audit


async def test_audit_rows_cannot_be_changed_or_deleted():
    async with SessionFactory() as session:
        sealed = await session.scalar(
            select(AuditLog.id).where(AuditLog.chain_seq.is_not(None)).limit(1)
        )
    for statement in (
        "UPDATE audit_log SET action = 'x' WHERE id = :id",
        "DELETE FROM audit_log WHERE id = :id",
    ):
        async with SessionFactory() as session:
            with pytest.raises(DBAPIError, match="append-only"):
                await session.execute(text(statement), {"id": sealed})


async def test_tampering_breaks_the_chain(client):
    await login(client, "admin@agro-demo.test")
    assert (await client.get("/api/v1/admin/audit/verify")).json()["valid"] is True
    async with SessionFactory() as session:
        row = (
            await session.execute(
                select(AuditLog.id, AuditLog.chain_seq, AuditLog.details)
                .where(AuditLog.chain_seq.is_not(None))
                .order_by(AuditLog.chain_seq)
                .limit(1)
                .offset(2)
            )
        ).one()
        # Someone with database access bypasses the trigger and edits an entry…
        await session.execute(
            text("ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_append_only")
        )
        await session.execute(
            text("UPDATE audit_log SET details = '{\"edited\": true}' WHERE id = :id"),
            {"id": row.id},
        )
        await session.commit()
    try:
        broken = (await client.get("/api/v1/admin/audit/verify")).json()
        assert broken["valid"] is False and broken["first_broken_seq"] == row.chain_seq
    finally:
        async with SessionFactory() as session:
            await session.execute(
                text("UPDATE audit_log SET details = CAST(:d AS jsonb) WHERE id = :id"),
                {"d": __import__("json").dumps(row.details), "id": row.id},
            )
            await session.execute(
                text("ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_append_only")
            )
            await session.commit()
    assert (await client.get("/api/v1/admin/audit/verify")).json()["valid"] is True

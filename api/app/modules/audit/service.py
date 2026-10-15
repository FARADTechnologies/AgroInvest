from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.models import AuditLog
from app.modules.identity.models import User


def record(
    session: AsyncSession,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict | None = None,
    ip: str | None = None,
) -> None:
    """Adds an audit entry in the caller's transaction, so it commits with the change itself."""
    session.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
            ip=ip,
        )
    )


async def seal(session: AsyncSession) -> int:
    """Chains every unsealed entry (database function from migration 0007)."""
    return int(await session.scalar(text("SELECT seal_audit_log()")) or 0)


_VERIFY = text(
    """
    WITH chain AS (
      SELECT chain_seq, hash, prev_hash,
             audit_entry_hash(prev_hash, a) AS recomputed,
             lag(hash) OVER (ORDER BY chain_seq) AS previous
      FROM audit_log a
      WHERE chain_seq IS NOT NULL
    )
    SELECT count(*) AS sealed,
           coalesce(max(chain_seq), 0) AS last_seq,
           min(chain_seq) FILTER (
             WHERE hash <> recomputed OR prev_hash IS DISTINCT FROM previous
           ) AS first_broken,
           (SELECT hash FROM audit_chain_head WHERE id = 1) AS head_hash,
           (SELECT hash FROM chain ORDER BY chain_seq DESC LIMIT 1) AS last_hash
    FROM chain
    """
)


async def verify(session: AsyncSession) -> dict:
    """Recomputes every hash. A changed entry breaks the chain at that entry; a deleted
    one leaves a gap in the sequence; the head must point at the last entry."""
    row = (await session.execute(_VERIFY)).one()
    gap = row.last_seq != row.sealed
    head_ok = row.head_hash == row.last_hash
    return {
        "sealed": row.sealed,
        "valid": row.first_broken is None and not gap and head_ok,
        "first_broken_seq": row.first_broken,
        "missing_entries": gap,
        "head_matches": head_ok,
    }

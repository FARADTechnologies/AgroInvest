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

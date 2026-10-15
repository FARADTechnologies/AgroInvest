"""Audit log for supervisors and administrators: read it and check its integrity."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import SessionDep, SupervisorUser
from app.modules.audit import service
from app.modules.audit.models import AuditLog
from app.modules.identity.models import User

router = APIRouter(prefix="/admin/audit", tags=["audit (supervisor)"])


class AuditEntryOut(BaseModel):
    id: int
    created_at: datetime
    actor_name: str | None
    actor_role: str | None
    action: str
    entity_type: str
    entity_id: str
    details: dict
    ip: str | None
    chain_seq: int | None
    hash: str | None


class AuditVerifyOut(BaseModel):
    sealed: int
    valid: bool
    first_broken_seq: int | None
    missing_entries: bool
    head_matches: bool
    checked_at: datetime


@router.get("", response_model=list[AuditEntryOut], summary="Latest audit entries")
async def entries(
    user: SupervisorUser,
    session: SessionDep,
    action: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[AuditEntryOut]:
    stmt = (
        select(AuditLog, User.full_name)
        .outerjoin(User, User.id == AuditLog.actor_id)
        .order_by(AuditLog.id.desc())
        .limit(limit)
    )
    if action:
        stmt = stmt.where(AuditLog.action == action)
    return [
        AuditEntryOut(
            id=a.id,
            created_at=a.created_at,
            actor_name=name,
            actor_role=a.actor_role,
            action=a.action,
            entity_type=a.entity_type,
            entity_id=a.entity_id,
            details=a.details or {},
            ip=a.ip,
            chain_seq=a.chain_seq,
            hash=a.hash,
        )
        for a, name in (await session.execute(stmt)).all()
    ]


@router.get(
    "/verify", response_model=AuditVerifyOut, summary="Seal new entries and verify the hash chain"
)
async def verify(user: SupervisorUser, session: SessionDep) -> AuditVerifyOut:
    await service.seal(session)
    await session.commit()
    result = await service.verify(session)
    return AuditVerifyOut(**result, checked_at=datetime.now(UTC))

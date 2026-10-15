import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.deps import EntrepreneurUser, SessionDep, SpecialistUser, StaffUser
from app.core.errors import conflict, not_found
from app.modules.audit import service as audit
from app.modules.entrepreneurs.models import Entrepreneur
from app.modules.integration import service
from app.modules.integration.client import EktisClient, get_ektis_client
from app.modules.integration.models import IntegrationLog, IntegrationOutbox, OutboxStatus
from app.modules.integration.schemas import (
    FarmerCheck,
    FaultIn,
    IntegrationStatus,
    LogOut,
    OutboxOut,
)

ClientDep = Annotated[EktisClient, Depends(get_ektis_client)]

router = APIRouter(prefix="/admin/integration", tags=["EKTIS integration (staff)"])
me_router = APIRouter(prefix="/me/entrepreneur", tags=["entrepreneur profile"])


def _outbox_out(m: IntegrationOutbox) -> OutboxOut:
    return OutboxOut(
        id=m.id,
        kind=m.kind,
        application_id=m.application_id,
        application_number=m.payload.get("applicationNumber"),
        area_code=(m.payload.get("parcel") or {}).get("code"),
        status=m.status,
        attempts=m.attempts,
        next_attempt_at=m.next_attempt_at,
        last_error=m.last_error,
        ektis_reference=m.ektis_reference,
        created_at=m.created_at,
        sent_at=m.sent_at,
    )


@router.get("/status", response_model=IntegrationStatus, summary="EKTIS connection and queue state")
async def status(user: StaffUser, session: SessionDep, client: ClientDep) -> IntegrationStatus:
    counts = dict(
        (
            await session.execute(
                select(IntegrationOutbox.status, func.count()).group_by(IntegrationOutbox.status)
            )
        ).all()
    )
    mode = get_settings().ektis_mode
    probe = await client.get_fault(service.new_request_id()) if mode == "mock" else None
    return IntegrationStatus(
        mode=mode,
        reachable=bool(probe and probe.ok),
        fault=(probe.data or {}).get("mode") if probe and probe.ok else None,
        pending=counts.get(OutboxStatus.PENDING, 0),
        sent=counts.get(OutboxStatus.SENT, 0),
        failed=counts.get(OutboxStatus.FAILED, 0),
    )


@router.get("/outbox", response_model=list[OutboxOut], summary="Messages for EKTIS, newest first")
async def outbox(
    user: StaffUser,
    session: SessionDep,
    application_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[OutboxOut]:
    stmt = select(IntegrationOutbox).order_by(IntegrationOutbox.created_at.desc()).limit(limit)
    if application_id:
        stmt = stmt.where(IntegrationOutbox.application_id == application_id)
    return [_outbox_out(m) for m in (await session.scalars(stmt)).all()]


@router.get("/log", response_model=list[LogOut], summary="Integration log (İnteqrasiya logu)")
async def integration_log(
    user: StaffUser, session: SessionDep, limit: Annotated[int, Query(ge=1, le=500)] = 100
) -> list[IntegrationLog]:
    stmt = select(IntegrationLog).order_by(IntegrationLog.id.desc()).limit(limit)
    return list((await session.scalars(stmt)).all())


@router.post(
    "/fault",
    response_model=IntegrationStatus,
    summary="Simulate an EKTIS outage in the mock (demo); never available against a real system",
)
async def set_fault(
    data: FaultIn, user: SpecialistUser, session: SessionDep, client: ClientDep, request: Request
) -> IntegrationStatus:
    if get_settings().ektis_mode != "mock":
        raise conflict("not_mock", "Nasazlıq simulyasiyası yalnız EKTİS mock rejimində mümkündür")
    result = await client.set_fault(data.mode, service.new_request_id())
    service.record(session, "mock.fault", result, f"Simulyasiya: {data.mode}", actor=user)
    audit.record(
        session,
        user,
        "integration.fault",
        "ektis",
        "mock",
        {"mode": data.mode},
        request.client.host if request.client else None,
    )
    if result.ok and data.mode == "NONE":
        await service.resume_pending(session)  # EKTIS is back: deliver what waited
    await session.commit()
    if result.ok and data.mode == "NONE":
        await service.process_due(session, client)
    return await status(user, session, client)


@router.post("/outbox/{message_id}/retry", response_model=OutboxOut, summary="Resend a message now")
async def retry(
    message_id: uuid.UUID,
    user: SpecialistUser,
    session: SessionDep,
    client: ClientDep,
    request: Request,
) -> OutboxOut:
    message = await session.get(IntegrationOutbox, message_id)
    if message is None:
        raise not_found("Mesaj tapılmadı")
    if message.status == OutboxStatus.SENT:
        raise conflict("already_sent", "Mesaj artıq EKTİS-ə çatdırılıb")
    audit.record(
        session,
        user,
        "integration.retry",
        "integration_outbox",
        str(message.id),
        {"application": message.payload.get("applicationNumber")},
        request.client.host if request.client else None,
    )
    await service.deliver(session, message, client)
    if message.status == OutboxStatus.FAILED:
        message.status = OutboxStatus.PENDING  # a manual retry restarts the automatic ones
        message.attempts = 0
    await session.commit()
    await session.refresh(message)
    return _outbox_out(message)


@me_router.post(
    "/ektis-check",
    response_model=FarmerCheck,
    summary="Check the applicant's own FİN/VÖEN in the EKTIS farmer registry",
)
async def ektis_check(
    user: EntrepreneurUser, session: SessionDep, client: ClientDep
) -> FarmerCheck:
    """Only the signed-in applicant's own identifier is checked, so the registry cannot be
    searched for other people through the portal."""
    profile = await session.scalar(select(Entrepreneur).where(Entrepreneur.user_id == user.id))
    if profile is None:
        raise not_found("Əvvəlcə sahibkar profilini doldurun")
    result = await service.lookup_farmer(session, profile, user, client)
    await session.commit()
    if result.ok:
        f = result.data or {}
        return FarmerCheck(
            available=True,
            registered=True,
            farmer_id=f.get("farmerId"),
            name=f.get("name"),
            registered_on=f.get("registeredOn"),
            rayon_iso=f.get("rayonIso"),
            declared_land_ha=f.get("declaredLandHa"),
            activities=f.get("activities") or [],
            message="EKTİS-də fermer kimi qeydiyyatdadır",
        )
    if result.status_code == 404:
        return FarmerCheck(
            available=True,
            registered=False,
            message="EKTİS-də qeydiyyat tapılmadı. Müraciət etmək üçün bu məcburi deyil.",
        )
    return FarmerCheck(
        available=False,
        registered=False,
        message="EKTİS hazırda cavab vermir. Müraciəti davam etdirə bilərsiniz; yoxlamanı sonra təkrarlayın.",
    )

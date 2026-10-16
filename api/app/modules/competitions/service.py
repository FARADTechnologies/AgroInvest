"""Competition management with a maker-checker approval.

A specialist drafts a competition and submits it; a supervisor who did not
create it approves (publishes) or returns it with a comment. The database
also refuses an approver equal to the creator. Only plots that are cleared of
mines and not already offered elsewhere can be published.

    DRAFT ──submit──▶ PENDING_APPROVAL ──approve──▶ PUBLISHED ──deadline──▶ (closed for applications)
      ▲                      │
      └──────return──────────┘
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import conflict, forbidden, not_found, unprocessable
from app.modules.applications.models import Application, ApplicationStatus, Outcome, StatusHistory
from app.modules.areas.models import AreaStatus, DeminingStatus, FarmArea
from app.modules.audit import service as audit
from app.modules.competitions.models import (
    Competition,
    CompetitionArea,
    CompetitionRequiredDoc,
    CompetitionStatus,
    DocumentType,
)
from app.modules.competitions.schemas import (
    AdminCompetition,
    AdminCompetitionList,
    AdminLot,
    CompetitionInput,
    LotResult,
    RequiredDocInput,
)
from app.modules.entrepreneurs.models import Entrepreneur
from app.modules.geo.models import Rayon
from app.modules.identity import permissions
from app.modules.identity.models import Role, User
from app.modules.identity.permissions import Permission
from app.modules.integration import service as integration
from app.modules.notifications.service import notify

C = CompetitionStatus
ACTIVE = (C.PENDING_APPROVAL, C.PUBLISHED)


async def next_number(session: AsyncSession) -> str:
    seq = await session.scalar(text("SELECT nextval('competition_number_seq')"))
    return f"MS-{datetime.now(UTC).year}-{seq:03d}"


def is_open(c: Competition) -> bool:
    now = datetime.now(UTC)
    return c.status == C.PUBLISHED and c.opens_at <= now < c.deadline_at


async def _validate_lots(
    session: AsyncSession, data: CompetitionInput, competition_id: uuid.UUID | None
) -> list[FarmArea]:
    areas = []
    for lot in data.lots:
        area = await session.get(FarmArea, lot.farm_area_id)
        if area is None:
            raise not_found("Sahə tapılmadı")
        if area.demining_status != DeminingStatus.CLEARED:
            raise unprocessable(
                "not_demined",
                f"{area.code}: minalardan təmizlənməmiş sahə müsabiqəyə çıxarıla bilməz",
            )
        if area.status in (AreaStatus.ALLOCATED, AreaStatus.WITHDRAWN, AreaStatus.DRAFT):
            raise unprocessable(
                "area_unavailable", f"{area.code}: sahə müsabiqə üçün əlçatan deyil"
            )
        busy = await session.scalar(
            select(Competition.number)
            .join(CompetitionArea, CompetitionArea.competition_id == Competition.id)
            .where(
                CompetitionArea.farm_area_id == area.id,
                Competition.status.in_(ACTIVE),
                Competition.id != competition_id if competition_id else True,
            )
        )
        if busy:
            raise conflict("area_in_competition", f"{area.code} artıq {busy} müsabiqəsindədir")
        areas.append(area)
    codes = {d.code for d in data.required_documents}
    known = set(
        (await session.scalars(select(DocumentType.code).where(DocumentType.code.in_(codes)))).all()
    )
    if codes - known:
        raise unprocessable("doc_type", f"Naməlum sənəd növü: {', '.join(sorted(codes - known))}")
    return areas


def _apply(comp: Competition, data: CompetitionInput) -> None:
    comp.title_az = data.title_az.strip()
    comp.description_az = data.description_az.strip()
    comp.conditions_az = data.conditions_az.strip()
    comp.opens_at = data.opens_at
    comp.deadline_at = data.deadline_at
    comp.areas.clear()
    for i, lot in enumerate(data.lots, start=1):
        comp.areas.append(
            CompetitionArea(
                farm_area_id=lot.farm_area_id, lot_no=i, min_investment_azn=lot.min_investment_azn
            )
        )
    comp.required_documents.clear()
    for d in data.required_documents:
        comp.required_documents.append(
            CompetitionRequiredDoc(doc_type_code=d.code, mandatory=d.mandatory)
        )


async def create(session: AsyncSession, user: User, data: CompetitionInput) -> Competition:
    if data.deadline_at <= datetime.now(UTC):
        raise unprocessable("deadline_past", "Son müraciət tarixi gələcəkdə olmalıdır")
    await _validate_lots(session, data, None)
    comp = Competition(
        number=await next_number(session),
        status=C.DRAFT,
        created_by=user.id,
        title_az="",
        description_az="",
        conditions_az="",
        opens_at=data.opens_at,
        deadline_at=data.deadline_at,
    )
    _apply(comp, data)
    session.add(comp)
    await session.flush()
    audit.record(
        session, user, "competition.create", "competition", str(comp.id), {"number": comp.number}
    )
    await session.commit()
    return comp


async def update(
    session: AsyncSession, comp: Competition, user: User, data: CompetitionInput
) -> Competition:
    if comp.status != C.DRAFT:
        raise conflict("not_editable", "Yalnız qaralama halında olan müsabiqə redaktə edilə bilər")
    await _validate_lots(session, data, comp.id)
    _apply(comp, data)
    audit.record(
        session, user, "competition.update", "competition", str(comp.id), {"number": comp.number}
    )
    await session.commit()
    return comp


async def submit(session: AsyncSession, comp: Competition, user: User) -> Competition:
    if comp.status != C.DRAFT:
        raise conflict("invalid_state", "Müsabiqə artıq təsdiqə göndərilib")
    if comp.deadline_at <= datetime.now(UTC):
        raise unprocessable("deadline_past", "Son müraciət tarixi keçib; tarixi yeniləyin")
    comp.status = C.PENDING_APPROVAL
    comp.submitted_at = datetime.now(UTC)
    # Everyone who may approve: supervisors, and staff the administrator gave that right.
    supervisors = (
        await session.scalars(
            select(User.id).where(
                User.is_active,
                (User.role == Role.SUPERVISOR)
                | (
                    (User.role == Role.STAFF)
                    & User.permissions.any(Permission.COMPETITIONS_APPROVE.value)
                ),
            )
        )
    ).all()
    for sid in supervisors:
        notify(
            session,
            sid,
            "competition_pending",
            "Təsdiq gözləyən müsabiqə",
            f"{comp.number}: {comp.title_az}",
            f"/admin/competitions/{comp.id}",
        )
    audit.record(
        session, user, "competition.submit", "competition", str(comp.id), {"number": comp.number}
    )
    await session.commit()
    return comp


def _check_reviewer(comp: Competition, user: User) -> None:
    if not permissions.has(user, Permission.COMPETITIONS_APPROVE):
        raise forbidden("Müsabiqəni yalnız Rəhbər təsdiq edə bilər")
    # Four eyes between staff; the administrator runs the portal alone and may approve their own.
    if comp.created_by == user.id and user.role != Role.ADMIN:
        raise forbidden("Müsabiqəni yaradan şəxs onu təsdiq edə bilməz (dörd göz prinsipi)")
    if comp.status != C.PENDING_APPROVAL:
        raise conflict("invalid_state", "Müsabiqə təsdiq gözləmir")


async def approve(
    session: AsyncSession, comp: Competition, user: User, comment: str | None, ip: str | None
) -> Competition:
    _check_reviewer(comp, user)
    # Re-check the plots: one may have been offered elsewhere since the draft was made.
    data = CompetitionInput(
        title_az=comp.title_az,
        description_az=comp.description_az,
        conditions_az=comp.conditions_az,
        opens_at=comp.opens_at,
        deadline_at=comp.deadline_at,
        lots=[
            {"farm_area_id": a.farm_area_id, "min_investment_azn": a.min_investment_azn}
            for a in comp.areas
        ],
        required_documents=[
            {"code": d.doc_type_code, "mandatory": d.mandatory} for d in comp.required_documents
        ],
    )
    areas = await _validate_lots(session, data, comp.id)
    now = datetime.now(UTC)
    comp.status = C.PUBLISHED
    comp.approved_by = user.id
    comp.approved_at = now
    comp.published_at = now
    comp.review_comment = (comment or "").strip() or None
    for area in areas:
        area.status = AreaStatus.IN_COMPETITION
    notify(
        session,
        comp.created_by,
        "competition_approved",
        "Müsabiqə təsdiq edildi və dərc olundu",
        f"{comp.number}: {comp.title_az}",
        f"/admin/competitions/{comp.id}",
    )
    audit.record(
        session,
        user,
        "competition.approve",
        "competition",
        str(comp.id),
        {"number": comp.number, "comment": comp.review_comment},
        ip,
    )
    await session.commit()
    return comp


async def send_back(
    session: AsyncSession, comp: Competition, user: User, comment: str | None, ip: str | None
) -> Competition:
    _check_reviewer(comp, user)
    if not comment or not comment.strip():
        raise unprocessable("comment_required", "Geri qaytarma səbəbi göstərilməlidir")
    comp.status = C.DRAFT
    comp.review_comment = comment.strip()
    notify(
        session,
        comp.created_by,
        "competition_returned",
        "Müsabiqə düzəliş üçün qaytarıldı",
        f"{comp.number}: {comment.strip()}",
        f"/admin/competitions/{comp.id}",
    )
    audit.record(
        session,
        user,
        "competition.return",
        "competition",
        str(comp.id),
        {"number": comp.number, "comment": comp.review_comment},
        ip,
    )
    await session.commit()
    return comp


async def set_lot_result(
    session: AsyncSession, comp: Competition, user: User, data: LotResult, ip: str | None
) -> int:
    """Sahə üzrə nəticə: the chosen application wins, every other open one for the plot is declined.

    A human makes this call explicitly; the reasons are shown to every applicant.
    """
    if not permissions.has(user, Permission.COMPETITIONS_MANAGE):
        raise forbidden()
    if is_open(comp):
        raise conflict("still_open", "Müraciət qəbulu bitmədən nəticə elan edilə bilməz")
    apps = (
        await session.scalars(
            select(Application).where(
                Application.competition_id == comp.id,
                Application.farm_area_id == data.farm_area_id,
                Application.status != ApplicationStatus.DRAFT,
            )
        )
    ).all()
    winner = next((a for a in apps if a.id == data.winner_application_id), None)
    if winner is None:
        raise not_found("Qalib müraciət bu sahəyə aid deyil")
    if any(a.outcome == Outcome.WON for a in apps):
        raise conflict("winner_exists", "Bu sahə üzrə qalib artıq müəyyən edilib")
    if winner.status != ApplicationStatus.UNDER_REVIEW:
        raise conflict(
            "winner_not_reviewed", "Qalib seçilən müraciət “Baxılır” statusunda olmalıdır"
        )

    now = datetime.now(UTC)
    owners = dict(
        (
            await session.execute(
                select(Entrepreneur.id, Entrepreneur.user_id).where(
                    Entrepreneur.id.in_([a.entrepreneur_id for a in apps])
                )
            )
        ).all()
    )
    declined = 0
    for app in apps:
        if app.status == ApplicationStatus.DECIDED:
            continue
        won = app.id == winner.id
        outcome = Outcome.WON if won else Outcome.REJECTED
        reason = data.reason_winner if won else data.reason_others
        session.add(
            StatusHistory(
                application_id=app.id,
                from_status=app.status,
                to_status=ApplicationStatus.DECIDED,
                outcome=outcome,
                actor_id=user.id,
                actor_role=user.role.value,
                reason=reason,
            )
        )
        app.status = ApplicationStatus.DECIDED
        app.outcome = outcome
        app.decision_reason = reason
        app.decided_by = user.id
        app.decided_at = now
        app.last_status_at = now
        label = "Qalib" if won else "İmtina"
        notify(
            session,
            owners[app.entrepreneur_id],
            "decided",
            f"Qərar verildi: {label}",
            f"{app.number} nömrəli müraciət üzrə qərar: {label}. Səbəb: {reason}",
            f"/cabinet/applications/{app.id}",
            app.id,
        )
        declined += 0 if won else 1
    area = await session.get(FarmArea, data.farm_area_id)
    if area is not None:
        area.status = AreaStatus.ALLOCATED
    # Same transaction: the result and the winner's EKTIS message are committed together.
    await integration.enqueue_decision(session, winner)
    audit.record(
        session,
        user,
        "competition.lot_result",
        "competition",
        str(comp.id),
        {
            "number": comp.number,
            "area": area.code if area else None,
            "winner": winner.number,
            "declined": declined,
        },
        ip,
    )
    await session.commit()
    return declined


# ── Read models ─────────────────────────────────────────────────────────────


async def to_admin(session: AsyncSession, comp: Competition, viewer: User) -> AdminCompetition:
    names = dict(
        (
            await session.execute(
                select(User.id, User.full_name).where(
                    User.id.in_([comp.created_by, comp.approved_by or comp.created_by])
                )
            )
        ).all()
    )
    area_ids = [a.farm_area_id for a in comp.areas]
    counts = dict(
        (
            await session.execute(
                select(Application.farm_area_id, func.count(Application.id))
                .where(
                    Application.competition_id == comp.id,
                    Application.status != ApplicationStatus.DRAFT,
                )
                .group_by(Application.farm_area_id)
            )
        ).all()
    )
    winners = dict(
        (
            await session.execute(
                select(Application.farm_area_id, Application.number).where(
                    Application.competition_id == comp.id, Application.outcome == Outcome.WON
                )
            )
        ).all()
    )
    rayons = dict((await session.execute(select(Rayon.id, Rayon.name_az))).all())
    areas = {
        a.id: a
        for a in (await session.scalars(select(FarmArea).where(FarmArea.id.in_(area_ids)))).all()
    }
    lots = [
        AdminLot(
            lot_no=ca.lot_no,
            farm_area_id=ca.farm_area_id,
            code=areas[ca.farm_area_id].code,
            name_az=areas[ca.farm_area_id].name_az,
            rayon_name=rayons.get(areas[ca.farm_area_id].rayon_id, ""),
            area_ha=areas[ca.farm_area_id].area_ha,
            purpose=areas[ca.farm_area_id].purpose,
            min_investment_azn=ca.min_investment_azn,
            applications=counts.get(ca.farm_area_id, 0),
            winner_number=winners.get(ca.farm_area_id),
        )
        for ca in comp.areas
    ]
    is_specialist = permissions.has(viewer, Permission.COMPETITIONS_MANAGE)
    return AdminCompetition(
        id=comp.id,
        number=comp.number,
        title_az=comp.title_az,
        description_az=comp.description_az,
        conditions_az=comp.conditions_az,
        status=comp.status,
        is_open=is_open(comp),
        opens_at=comp.opens_at,
        deadline_at=comp.deadline_at,
        created_by_name=names.get(comp.created_by, ""),
        created_by_id=comp.created_by,
        submitted_at=comp.submitted_at,
        approved_by_name=names.get(comp.approved_by) if comp.approved_by else None,
        approved_at=comp.approved_at,
        review_comment=comp.review_comment,
        published_at=comp.published_at,
        lots=lots,
        required_documents=[
            RequiredDocInput(code=d.doc_type_code, mandatory=d.mandatory)
            for d in comp.required_documents
        ],
        application_count=sum(counts.values()),
        total_ha=sum((lot.area_ha for lot in lots), Decimal(0)),
        can_edit=is_specialist and comp.status == C.DRAFT,
        can_submit=is_specialist and comp.status == C.DRAFT,
        can_review=permissions.has(viewer, Permission.COMPETITIONS_APPROVE)
        and comp.status == C.PENDING_APPROVAL
        and comp.created_by != viewer.id,
    )


async def list_admin(
    session: AsyncSession, viewer: User, status: CompetitionStatus | None
) -> AdminCompetitionList:
    stmt = (
        select(Competition)
        .options(selectinload(Competition.areas), selectinload(Competition.required_documents))
        .order_by(Competition.created_at.desc())
    )
    if status:
        stmt = stmt.where(Competition.status == status)
    comps = (await session.scalars(stmt)).all()
    counts = {s.value: 0 for s in CompetitionStatus}
    for st, n in (
        await session.execute(select(Competition.status, func.count()).group_by(Competition.status))
    ).all():
        counts[st.value if hasattr(st, "value") else st] = n
    return AdminCompetitionList(
        items=[await to_admin(session, c, viewer) for c in comps], status_counts=counts
    )

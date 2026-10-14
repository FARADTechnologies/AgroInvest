"""Application lifecycle: draft, submission, review, decision.

The state machine lives here and only here. Every change records who made it,
when and why in status_history, notifies the applicant and, for staff
actions, writes an audit entry, all in one transaction.

    DRAFT ──submit──▶ RECEIVED ──▶ UNDER_REVIEW ──▶ DECIDED (WON | REJECTED)
                                     ▲      │
                     applicant answers      ▼
                                   INFO_REQUESTED
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError

from app.core.errors import DomainError, conflict, forbidden, not_found, unprocessable
from app.modules.applications.models import (
    Application,
    ApplicationStatus,
    BusinessPlan,
    InfoRequest,
    Outcome,
    StatusHistory,
)
from app.modules.applications.schemas import (
    AdminApplicationPage,
    ApplicantOut,
    ApplicationOut,
    ApplicationSummary,
    AreaRef,
    BusinessPlanData,
    CompetitionRef,
    Completeness,
    DocumentOut,
    HistoryOut,
    InfoRequestOut,
    RequiredDocStatus,
    TransitionRequest,
    UpdateApplication,
)
from app.modules.areas.models import FarmArea
from app.modules.audit import service as audit
from app.modules.competitions.models import (
    Competition,
    CompetitionArea,
    CompetitionRequiredDoc,
    CompetitionStatus,
    DocumentType,
)
from app.modules.documents import storage
from app.modules.documents.models import ApplicationDocument
from app.modules.entrepreneurs.models import Entrepreneur, EntrepreneurType
from app.modules.geo.models import Rayon, Village
from app.modules.identity.models import STAFF_ROLES, Role, User
from app.modules.notifications.service import notify

S = ApplicationStatus

# Staff transitions. INFO_REQUESTED → UNDER_REVIEW happens only when the applicant answers.
TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    S.RECEIVED: {S.UNDER_REVIEW},
    S.UNDER_REVIEW: {S.INFO_REQUESTED, S.DECIDED},
}
REASON_REQUIRED = {S.INFO_REQUESTED, S.DECIDED}

ROLE_LABEL = {
    Role.ENTREPRENEUR: "Sahibkar",
    Role.SPECIALIST: "Mütəxəssis",
    Role.SUPERVISOR: "Rəhbər",
    Role.ADMIN: "Administrator",
}

REQUIRED_PLAN_FIELDS = {
    "investment_azn": "İnvestisiya məbləği",
    "jobs_planned": "Yaradılacaq iş yerlərinin sayı",
    "implementation_months": "İcra müddəti",
    "summary": "Layihənin qısa təsviri",
}


def mask(value: str | None) -> str:
    """Shows only the first two and last two characters: 14••••••21."""
    if not value:
        return ""
    if len(value) <= 4:
        return "•" * len(value)
    return f"{value[:2]}{'•' * (len(value) - 4)}{value[-2:]}"


def _now() -> datetime:
    return datetime.now(UTC)


def _is_open(c: Competition, now: datetime | None = None) -> bool:
    now = now or _now()
    return c.status == CompetitionStatus.PUBLISHED and c.opens_at <= now < c.deadline_at


def _applicant_type(app: Application, profile: Entrepreneur | None) -> EntrepreneurType | None:
    if app.applicant_snapshot:
        return EntrepreneurType(app.applicant_snapshot["type"])
    return profile.type if profile else None


# ── Loading and access ──────────────────────────────────────────────────────


async def get_profile(session: AsyncSession, user: User) -> Entrepreneur | None:
    return await session.scalar(select(Entrepreneur).where(Entrepreneur.user_id == user.id))


async def get_owned(session: AsyncSession, user: User, application_id: uuid.UUID) -> Application:
    """The application, if it belongs to this entrepreneur. Others get 404, not 403,
    so the existence of someone else's application is never revealed."""
    profile = await get_profile(session, user)
    app = await session.get(Application, application_id)
    if app is None or profile is None or app.entrepreneur_id != profile.id:
        raise not_found("Müraciət tapılmadı")
    return app


async def get_for_staff(session: AsyncSession, application_id: uuid.UUID) -> Application:
    app = await session.get(Application, application_id)
    if app is None or app.status == S.DRAFT:  # drafts are private to the applicant
        raise not_found("Müraciət tapılmadı")
    return app


# ── Drafting ────────────────────────────────────────────────────────────────


async def create_draft(session: AsyncSession, user: User, area_code: str) -> Application:
    profile = await get_profile(session, user)
    if profile is None:
        raise unprocessable("profile_required", "Əvvəlcə sahibkar məlumatlarını doldurun")

    area = await session.scalar(select(FarmArea).where(FarmArea.code == area_code.strip().upper()))
    if area is None:
        raise not_found("Sahə tapılmadı")
    now = _now()
    competition = await session.scalar(
        select(Competition)
        .join(CompetitionArea, CompetitionArea.competition_id == Competition.id)
        .where(
            CompetitionArea.farm_area_id == area.id,
            Competition.status == CompetitionStatus.PUBLISHED,
            Competition.opens_at <= now,
            Competition.deadline_at > now,
        )
    )
    if competition is None:
        raise unprocessable("no_open_competition", "Bu sahə üzrə hazırda açıq müsabiqə yoxdur")

    existing = await session.scalar(
        select(Application).where(
            Application.entrepreneur_id == profile.id,
            Application.competition_id == competition.id,
            Application.farm_area_id == area.id,
        )
    )
    if existing is not None:
        if existing.status == S.DRAFT:
            return existing  # resume the draft instead of creating a second one
        raise conflict(
            "already_applied",
            f"Bu sahə üzrə artıq müraciətiniz var ({existing.number})",
        )

    app = Application(
        entrepreneur_id=profile.id,
        competition_id=competition.id,
        farm_area_id=area.id,
        activity=area.purpose,
        status=S.DRAFT,
        business_plan=BusinessPlan(),
    )
    session.add(app)
    await session.flush()
    await _history(session, app, None, S.DRAFT, user, "Qaralama yaradıldı")
    await session.commit()
    return app


async def update_draft(session: AsyncSession, app: Application, data: UpdateApplication) -> None:
    if app.status != S.DRAFT:
        raise conflict("not_editable", "Göndərilmiş müraciət dəyişdirilə bilməz")
    if data.activity is not None:
        app.activity = data.activity
    if data.project_title is not None:
        app.project_title = data.project_title.strip() or None
    if data.business_plan is not None:
        plan = app.business_plan or BusinessPlan(application_id=app.id)
        for key, value in data.business_plan.model_dump(exclude_unset=True).items():
            setattr(plan, key, value.strip() if isinstance(value, str) else value)
        app.business_plan = plan
    await session.commit()


# ── Documents ───────────────────────────────────────────────────────────────


async def add_document(
    session: AsyncSession,
    app: Application,
    user: User,
    doc_type_code: str,
    filename: str,
    data: bytes,
) -> ApplicationDocument:
    if app.status not in (S.DRAFT, S.INFO_REQUESTED):
        raise conflict("not_editable", "Bu mərhələdə sənəd əlavə etmək mümkün deyil")
    doc_type = await session.get(DocumentType, doc_type_code)
    required = await session.scalar(
        select(CompetitionRequiredDoc).where(
            CompetitionRequiredDoc.competition_id == app.competition_id,
            CompetitionRequiredDoc.doc_type_code == doc_type_code,
        )
    )
    if doc_type is None or required is None:
        raise unprocessable("doc_type", "Bu sənəd növü müsabiqə üçün nəzərdə tutulmayıb")

    stored = storage.save(data, doc_type.max_mb)
    previous = (
        await session.scalars(
            select(ApplicationDocument).where(
                ApplicationDocument.application_id == app.id,
                ApplicationDocument.doc_type_code == doc_type_code,
                ApplicationDocument.is_current.is_(True),
            )
        )
    ).all()
    version = 1
    for old in previous:
        old.is_current = False  # earlier versions are kept for the record
        version = max(version, old.version + 1)

    open_request = None
    if app.status == S.INFO_REQUESTED:
        open_request = await _open_info_request(session, app.id)

    doc = ApplicationDocument(
        application_id=app.id,
        doc_type_code=doc_type_code,
        original_name=(filename or "sened")[:255],
        stored_name=stored.stored_name,
        mime=stored.mime,
        size_bytes=stored.size,
        sha256=stored.sha256,
        version=version,
        uploaded_by=user.id,
        info_request_id=open_request.id if open_request else None,
    )
    session.add(doc)
    await session.commit()
    return doc


async def remove_document(session: AsyncSession, app: Application, document_id: uuid.UUID) -> None:
    if app.status != S.DRAFT:
        raise conflict("not_editable", "Göndərilmiş müraciətin sənədi silinə bilməz")
    doc = await session.get(ApplicationDocument, document_id)
    if doc is None or doc.application_id != app.id:
        raise not_found("Sənəd tapılmadı")
    storage.delete(doc.stored_name)
    await session.delete(doc)
    await session.commit()


async def document_for_download(
    session: AsyncSession, app: Application, document_id: uuid.UUID
) -> ApplicationDocument:
    doc = await session.get(ApplicationDocument, document_id)
    if doc is None or doc.application_id != app.id:
        raise not_found("Sənəd tapılmadı")
    return doc


# ── Completeness and submission ─────────────────────────────────────────────


async def _required_docs(
    session: AsyncSession, app: Application, applicant_type: EntrepreneurType | None
) -> list[CompetitionRequiredDoc]:
    rows = (
        await session.scalars(
            select(CompetitionRequiredDoc).where(
                CompetitionRequiredDoc.competition_id == app.competition_id
            )
        )
    ).all()
    wanted = {"ANY", applicant_type.value if applicant_type else "ANY"}
    return [r for r in rows if r.document_type.applies_to in wanted]


async def _current_docs(session: AsyncSession, app_id: uuid.UUID) -> list[ApplicationDocument]:
    return list(
        (
            await session.scalars(
                select(ApplicationDocument)
                .where(
                    ApplicationDocument.application_id == app_id,
                    ApplicationDocument.is_current.is_(True),
                )
                .order_by(ApplicationDocument.created_at)
            )
        ).all()
    )


async def completeness(
    session: AsyncSession, app: Application, profile: Entrepreneur | None
) -> Completeness:
    missing: list[str] = []
    has_profile = profile is not None or app.applicant_snapshot is not None
    if not has_profile:
        missing.append("Sahibkar məlumatları")
    plan = app.business_plan
    plan_ok = True
    for field, label in REQUIRED_PLAN_FIELDS.items():
        value = getattr(plan, field, None) if plan else None
        if value in (None, ""):
            plan_ok = False
            missing.append(label)
    docs = {d.doc_type_code for d in await _current_docs(session, app.id)}
    docs_ok = True
    for req in await _required_docs(session, app, _applicant_type(app, profile)):
        if req.mandatory and req.doc_type_code not in docs:
            docs_ok = False
            missing.append(req.document_type.name_az)
    return Completeness(
        profile=has_profile,
        activity=app.activity is not None,
        business_plan=plan_ok,
        documents=docs_ok,
        missing=missing,
    )


def _snapshot(profile: Entrepreneur) -> dict:
    return {
        "type": profile.type.value,
        "fin": profile.fin,
        "voen": profile.voen,
        "full_name": profile.full_name,
        "company_name": profile.company_name,
        "legal_form": profile.legal_form,
        "phone": profile.phone,
        "email": profile.email,
        "address": profile.address,
        "is_local": profile.is_local,
        "origin_rayon_id": profile.origin_rayon_id,
        "ektis_farmer_id": profile.ektis_farmer_id,
        "captured_at": _now().isoformat(),
    }


async def submit(session: AsyncSession, app: Application, user: User) -> Application:
    if app.status != S.DRAFT:
        raise conflict("already_submitted", "Müraciət artıq göndərilib")
    competition = await session.get(Competition, app.competition_id)
    if competition is None or not _is_open(competition):
        raise unprocessable("deadline_passed", "Müsabiqə üzrə müraciət müddəti başa çatıb")
    profile = await get_profile(session, user)
    check = await completeness(session, app, profile)
    if check.missing:
        raise DomainError(422, "incomplete", "Müraciət tam deyil: " + ", ".join(check.missing))

    now = _now()
    seq = await session.scalar(text("SELECT nextval('application_number_seq')"))
    app.number = f"QIM-{now.year}-{seq:06d}"
    app.applicant_snapshot = _snapshot(profile)  # later profile edits do not change it
    app.submitted_at = now
    await _move(session, app, S.RECEIVED, user, "Müraciət elektron qaydada təqdim edildi")
    notify(
        session,
        user.id,
        "application_received",
        "Müraciətiniz qəbul edildi",
        f"{app.number} nömrəli müraciətiniz qeydə alındı və baxılma növbəsinə daxil oldu.",
        link=f"/cabinet/applications/{app.id}",
        application_id=app.id,
    )
    await session.commit()
    return app


# ── Review ──────────────────────────────────────────────────────────────────


async def _open_info_request(session: AsyncSession, app_id: uuid.UUID) -> InfoRequest | None:
    return await session.scalar(
        select(InfoRequest)
        .where(InfoRequest.application_id == app_id, InfoRequest.responded_at.is_(None))
        .order_by(InfoRequest.created_at.desc())
    )


async def _history(
    session: AsyncSession,
    app: Application,
    from_status: ApplicationStatus | None,
    to_status: ApplicationStatus,
    actor: User | None,
    reason: str | None,
    outcome: Outcome | None = None,
) -> None:
    session.add(
        StatusHistory(
            application_id=app.id,
            from_status=from_status,
            to_status=to_status,
            outcome=outcome,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else None,
            reason=reason,
        )
    )


async def _move(
    session: AsyncSession,
    app: Application,
    to: ApplicationStatus,
    actor: User,
    reason: str | None,
    outcome: Outcome | None = None,
) -> None:
    previous = app.status
    app.status = to
    app.last_status_at = _now()
    await _history(session, app, previous, to, actor, reason, outcome)


async def _owner_user_id(session: AsyncSession, app: Application) -> uuid.UUID:
    return await session.scalar(
        select(Entrepreneur.user_id).where(Entrepreneur.id == app.entrepreneur_id)
    )


def allowed_transitions(app: Application, viewer: User) -> list[ApplicationStatus]:
    if viewer.role not in (Role.SPECIALIST, Role.ADMIN):
        return []
    return sorted(TRANSITIONS.get(app.status, set()), key=list(ApplicationStatus).index)


async def transition(
    session: AsyncSession, app: Application, staff: User, req: TransitionRequest, ip: str | None
) -> Application:
    if staff.role not in (Role.SPECIALIST, Role.ADMIN):
        raise forbidden()
    if req.expected_version is not None and req.expected_version != app.version:
        raise conflict(
            "stale", "Müraciət başqa istifadəçi tərəfindən dəyişdirilib. Səhifəni yeniləyin."
        )
    if req.to not in TRANSITIONS.get(app.status, set()):
        raise conflict("invalid_transition", "Bu status dəyişikliyi mümkün deyil")
    reason = (req.reason or "").strip() or None
    if req.to in REASON_REQUIRED and not reason:
        raise unprocessable("reason_required", "Səbəb göstərilməlidir")

    owner_id = await _owner_user_id(session, app)
    link = f"/cabinet/applications/{app.id}"
    before = app.status

    if req.to == S.UNDER_REVIEW:
        await _move(session, app, S.UNDER_REVIEW, staff, reason or "Müraciətə baxılmağa başlanıldı")
        notify(
            session,
            owner_id,
            "under_review",
            "Müraciətinizə baxılır",
            f"{app.number} nömrəli müraciətinizə mütəxəssis baxmağa başladı.",
            link,
            app.id,
        )

    elif req.to == S.INFO_REQUESTED:
        valid = {
            r.doc_type_code
            for r in (
                await session.scalars(
                    select(CompetitionRequiredDoc).where(
                        CompetitionRequiredDoc.competition_id == app.competition_id
                    )
                )
            ).all()
        }
        docs = [c for c in req.requested_doc_types if c in valid]
        session.add(
            InfoRequest(
                application_id=app.id,
                requested_by=staff.id,
                message=reason,
                requested_doc_types=docs,
            )
        )
        await _move(session, app, S.INFO_REQUESTED, staff, reason)
        notify(
            session,
            owner_id,
            "info_requested",
            "Əlavə məlumat tələb olunur",
            f"{app.number}: {reason}",
            link,
            app.id,
        )

    elif req.to == S.DECIDED:
        if req.outcome is None:
            raise unprocessable(
                "outcome_required", "Qərarın nəticəsi (Qalib və ya İmtina) seçilməlidir"
            )
        if req.outcome == Outcome.WON:
            other_winner = await session.scalar(
                select(Application.number).where(
                    Application.competition_id == app.competition_id,
                    Application.farm_area_id == app.farm_area_id,
                    Application.outcome == Outcome.WON,
                    Application.id != app.id,
                )
            )
            if other_winner:
                raise conflict(
                    "winner_exists", f"Bu sahə üzrə qalib artıq müəyyən edilib ({other_winner})"
                )
        app.outcome = req.outcome
        app.decision_reason = reason
        app.decided_by = staff.id
        app.decided_at = _now()
        await _move(session, app, S.DECIDED, staff, reason, req.outcome)
        label = "Qalib" if req.outcome == Outcome.WON else "İmtina"
        notify(
            session,
            owner_id,
            "decided",
            f"Qərar verildi: {label}",
            f"{app.number} nömrəli müraciət üzrə qərar: {label}. Səbəb: {reason}",
            link,
            app.id,
        )

    audit.record(
        session,
        staff,
        "application.transition",
        "application",
        str(app.id),
        {
            "number": app.number,
            "from": before.value,
            "to": req.to.value,
            "outcome": req.outcome.value if req.outcome else None,
        },
        ip,
    )
    try:
        await session.commit()
    except StaleDataError as exc:
        await session.rollback()
        raise conflict(
            "stale", "Müraciət başqa istifadəçi tərəfindən dəyişdirilib. Səhifəni yeniləyin."
        ) from exc
    except IntegrityError as exc:
        await session.rollback()
        raise conflict("winner_exists", "Bu sahə üzrə qalib artıq müəyyən edilib") from exc
    return app


async def respond_info(
    session: AsyncSession, app: Application, user: User, text_: str
) -> Application:
    if app.status != S.INFO_REQUESTED:
        raise conflict("no_info_request", "Bu müraciət üzrə cavab gözlənilmir")
    request = await _open_info_request(session, app.id)
    if request is None:
        raise conflict("no_info_request", "Bu müraciət üzrə cavab gözlənilmir")
    uploaded = {
        d.doc_type_code
        for d in await _current_docs(session, app.id)
        if d.info_request_id == request.id
    }
    missing = [c for c in request.requested_doc_types if c not in uploaded]
    if missing:
        names = (
            await session.scalars(
                select(DocumentType.name_az).where(DocumentType.code.in_(missing))
            )
        ).all()
        raise unprocessable(
            "documents_missing", "Tələb olunan sənədləri əlavə edin: " + ", ".join(names)
        )

    request.responded_at = _now()
    request.response_text = text_.strip()
    await _move(session, app, S.UNDER_REVIEW, user, "Əlavə məlumat təqdim edildi")
    notify(
        session,
        request.requested_by,
        "info_provided",
        "Əlavə məlumat təqdim edildi",
        f"{app.number} nömrəli müraciət üzrə sahibkar cavab verdi.",
        f"/admin/applications/{app.id}",
        app.id,
    )
    await session.commit()
    return app


# ── Read models ─────────────────────────────────────────────────────────────


async def build_out(session: AsyncSession, app: Application, viewer: User) -> ApplicationOut:
    staff = viewer.role in STAFF_ROLES
    profile = await session.get(Entrepreneur, app.entrepreneur_id)
    area, rayon_name, village_name = (
        await session.execute(
            select(FarmArea, Rayon.name_az, Village.name_az)
            .join(Rayon, Rayon.id == FarmArea.rayon_id)
            .outerjoin(Village, Village.id == FarmArea.village_id)
            .where(FarmArea.id == app.farm_area_id)
        )
    ).one()
    competition = await session.get(Competition, app.competition_id)
    min_investment = await session.scalar(
        select(CompetitionArea.min_investment_azn).where(
            CompetitionArea.competition_id == app.competition_id,
            CompetitionArea.farm_area_id == app.farm_area_id,
        )
    )

    # Staff see the frozen copy that was submitted; the applicant sees it once submitted too.
    data = app.applicant_snapshot or (_snapshot(profile) if profile else None)
    applicant = None
    if data:
        is_company = data["type"] == EntrepreneurType.COMPANY.value
        raw_id = data["voen"] if is_company else data["fin"]
        origin = (
            await session.scalar(select(Rayon.name_az).where(Rayon.id == data["origin_rayon_id"]))
            if data.get("origin_rayon_id")
            else None
        )
        applicant = ApplicantOut(
            type=data["type"],
            display_name=data.get("company_name") or data["full_name"],
            full_name=data["full_name"],
            company_name=data.get("company_name"),
            identifier_label="VÖEN" if is_company else "FİN",
            identifier=mask(raw_id) if staff else (raw_id or ""),
            identifier_masked=staff,
            phone=data["phone"],
            email=data["email"],
            address=data.get("address"),
            is_local=bool(data.get("is_local")),
            origin_rayon_name=origin,
            ektis_farmer_id=data.get("ektis_farmer_id"),
        )

    docs = await _current_docs(session, app.id)
    type_names = dict(
        (await session.execute(select(DocumentType.code, DocumentType.name_az))).all()
    )
    doc_out = [
        DocumentOut(
            id=d.id,
            doc_type_code=d.doc_type_code,
            doc_type_name=type_names.get(d.doc_type_code, d.doc_type_code),
            original_name=d.original_name,
            mime=d.mime,
            size_bytes=d.size_bytes,
            version=d.version,
            uploaded_at=d.created_at,
            info_request_id=d.info_request_id,
        )
        for d in docs
    ]
    by_type = {d.doc_type_code: d for d in doc_out}
    required = [
        RequiredDocStatus(
            code=r.doc_type_code,
            name_az=r.document_type.name_az,
            description_az=r.document_type.description_az,
            mandatory=r.mandatory,
            max_mb=r.document_type.max_mb,
            document=by_type.get(r.doc_type_code),
        )
        for r in await _required_docs(session, app, _applicant_type(app, profile))
    ]

    actors = {}
    history_rows = (
        await session.scalars(
            select(StatusHistory)
            .where(StatusHistory.application_id == app.id)
            .order_by(StatusHistory.created_at, StatusHistory.id)
        )
    ).all()
    actor_ids = {h.actor_id for h in history_rows if h.actor_id}
    if actor_ids:
        actors = dict(
            (
                await session.execute(select(User.id, User.full_name).where(User.id.in_(actor_ids)))
            ).all()
        )
    history = [
        HistoryOut(
            from_status=h.from_status,
            to_status=h.to_status,
            outcome=h.outcome,
            actor_label=(
                f"{ROLE_LABEL.get(Role(h.actor_role), '')} · {actors.get(h.actor_id, '')}"
                if staff and h.actor_role
                else ROLE_LABEL.get(Role(h.actor_role), "Sistem")
                if h.actor_role
                else "Sistem"
            ),
            reason=h.reason,
            created_at=h.created_at,
        )
        for h in history_rows
    ]

    latest_request = await session.scalar(
        select(InfoRequest)
        .where(InfoRequest.application_id == app.id)
        .order_by(InfoRequest.created_at.desc())
    )
    info = None
    if latest_request:
        info = InfoRequestOut(
            id=latest_request.id,
            message=latest_request.message,
            requested_docs=[
                {"code": c, "name_az": type_names.get(c, c)}
                for c in latest_request.requested_doc_types
            ],
            created_at=latest_request.created_at,
            responded_at=latest_request.responded_at,
            response_text=latest_request.response_text,
        )

    plan = app.business_plan
    return ApplicationOut(
        id=app.id,
        number=app.number,
        status=app.status,
        outcome=app.outcome,
        decision_reason=app.decision_reason,
        decided_at=app.decided_at,
        submitted_at=app.submitted_at,
        created_at=app.created_at,
        last_status_at=app.last_status_at,
        version=app.version,
        activity=app.activity,
        project_title=app.project_title,
        applicant=applicant,
        area=AreaRef(
            id=area.id,
            code=area.code,
            name_az=area.name_az,
            rayon_name=rayon_name,
            village_name=village_name,
            area_ha=area.area_ha,
            purpose=area.purpose,
        ),
        competition=CompetitionRef(
            id=competition.id,
            number=competition.number,
            title_az=competition.title_az,
            deadline_at=competition.deadline_at,
            is_open=_is_open(competition),
        ),
        min_investment_azn=min_investment,
        business_plan=BusinessPlanData.model_validate(plan, from_attributes=True)
        if plan
        else BusinessPlanData(),
        documents=doc_out,
        required_documents=required,
        history=history,
        info_request=info,
        completeness=await completeness(session, app, profile),
        allowed_transitions=allowed_transitions(app, viewer),
    )


def _summary_query():
    return (
        select(
            Application,
            FarmArea.code,
            FarmArea.name_az,
            FarmArea.purpose,
            FarmArea.area_ha,
            Rayon.name_az,
            Competition.number,
            Competition.deadline_at,
            BusinessPlan.investment_azn,
            BusinessPlan.jobs_planned,
            Entrepreneur,
        )
        .join(FarmArea, FarmArea.id == Application.farm_area_id)
        .join(Rayon, Rayon.id == FarmArea.rayon_id)
        .join(Competition, Competition.id == Application.competition_id)
        .join(Entrepreneur, Entrepreneur.id == Application.entrepreneur_id)
        .outerjoin(BusinessPlan, BusinessPlan.application_id == Application.id)
    )


def _summary(row, staff: bool) -> ApplicationSummary:
    app, code, name, purpose, ha, rayon, comp_no, deadline, invest, jobs, profile = row
    snap = app.applicant_snapshot or {}
    applicant_name = snap.get("company_name") or snap.get("full_name") or profile.display_name
    identifier = (snap.get("voen") or snap.get("fin")) or (profile.voen or profile.fin)
    return ApplicationSummary(
        id=app.id,
        number=app.number,
        status=app.status,
        outcome=app.outcome,
        area_code=code,
        area_name=name,
        rayon_name=rayon,
        purpose=purpose,
        area_ha=ha,
        competition_number=comp_no,
        deadline_at=deadline,
        submitted_at=app.submitted_at,
        last_status_at=app.last_status_at,
        investment_azn=invest,
        jobs_planned=jobs,
        applicant_name=applicant_name if staff else None,
        applicant_identifier=mask(identifier) if staff else None,
    )


async def list_mine(session: AsyncSession, user: User) -> list[ApplicationSummary]:
    profile = await get_profile(session, user)
    if profile is None:
        return []
    rows = (
        await session.execute(
            _summary_query()
            .where(Application.entrepreneur_id == profile.id)
            .order_by(Application.last_status_at.desc())
        )
    ).all()
    return [_summary(r, staff=False) for r in rows]


async def list_for_staff(
    session: AsyncSession,
    status: ApplicationStatus | None,
    competition_id: uuid.UUID | None,
    q: str | None,
    page: int,
    size: int,
) -> AdminApplicationPage:
    base = _summary_query().where(Application.status != S.DRAFT)
    if competition_id:
        base = base.where(Application.competition_id == competition_id)
    if q and q.strip():
        pattern = func.az_fold(f"%{q.strip()}%")
        base = base.where(
            or_(
                func.az_fold(func.coalesce(Application.number, "")).like(pattern),
                func.az_fold(FarmArea.code).like(pattern),
                func.az_fold(func.coalesce(Entrepreneur.company_name, Entrepreneur.full_name)).like(
                    pattern
                ),
            )
        )
    filtered = base.where(Application.status == status) if status else base
    total = await session.scalar(select(func.count()).select_from(filtered.subquery()))
    rows = (
        await session.execute(
            filtered.order_by(Application.last_status_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).all()

    status_q = select(Application.status, func.count(Application.id)).where(
        Application.status != S.DRAFT
    )
    if competition_id:
        status_q = status_q.where(Application.competition_id == competition_id)
    counts = {s.value: 0 for s in ApplicationStatus if s != S.DRAFT}
    for st, n in (await session.execute(status_q.group_by(Application.status))).all():
        counts[st.value if hasattr(st, "value") else st] = n

    return AdminApplicationPage(
        items=[_summary(r, staff=True) for r in rows],
        total=total or 0,
        page=page,
        size=size,
        status_counts=counts,
    )

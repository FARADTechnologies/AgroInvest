"""Background applications so the review queue, history and statistics are not empty.

They are inserted directly (not through the API) because some belong to a
competition whose deadline has already passed. Timestamps are back-dated
relative to the moment the seed runs. All applicants are fictional.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.applications.models import (
    Application,
    ApplicationStatus,
    BusinessPlan,
    InfoRequest,
    Outcome,
    StatusHistory,
)
from app.modules.applications.service import _snapshot
from app.modules.areas.models import AreaStatus
from app.modules.competitions.models import Competition, CompetitionRequiredDoc
from app.modules.documents import storage
from app.modules.documents.models import ApplicationDocument
from app.modules.entrepreneurs.models import Entrepreneur
from app.modules.identity.models import User
from app.modules.notifications.models import Notification
from app.seed.demo import DemoPeople

S = ApplicationStatus


def placeholder_pdf(title: str) -> bytes:
    """A small valid one-page PDF, so seeded documents open in any viewer."""
    content = f"BT /F1 14 Tf 72 760 Td ({title}) Tj 0 -22 Td /F1 10 Tf (Demo document - placeholder) Tj ET"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return out


@dataclass
class Plan:
    applicant: int  # index into people.applicants, -1 = the demo entrepreneur
    competition: int  # index into the seeded competitions
    lot: int  # 0-based lot within the competition
    status: ApplicationStatus
    days_ago: int
    investment: int
    jobs: int
    months: int
    title: str
    outcome: Outcome | None = None
    reason: str | None = None


PLANS = [
    # Closed competition: decided, under review, waiting for information, just received.
    Plan(
        0,
        3,
        0,
        S.DECIDED,
        34,
        1_450_000,
        42,
        24,
        "İntensiv fındıq və alma bağı",
        Outcome.WON,
        "Ən yüksək investisiya həcmi, 42 yeni iş yeri və sənədləşdirilmiş təcrübə.",
    ),
    Plan(
        5,
        3,
        0,
        S.DECIDED,
        33,
        620_000,
        15,
        30,
        "Üzümlük və kiçik emal sexi",
        Outcome.REJECTED,
        "Eyni sahə üzrə daha yüksək investisiya və iş yeri təklif edən müraciət qalib seçildi.",
    ),
    Plan(1, 3, 1, S.UNDER_REVIEW, 31, 980_000, 28, 20, "Nar bağı və soyuducu anbar"),
    Plan(
        3,
        3,
        2,
        S.INFO_REQUESTED,
        29,
        240_000,
        9,
        18,
        "Ailə təsərrüfatı: meyvə bağı",
        reason="Kənd təsərrüfatı sahəsində təcrübəni təsdiq edən sənədləri əlavə edin.",
    ),
    Plan(4, 3, 3, S.RECEIVED, 26, 310_000, 11, 24, "Tərəvəz və bostan bitkiləri"),
    # Open competitions.
    Plan(2, 0, 1, S.RECEIVED, 4, 760_000, 22, 18, "Taxılçılıq və yem bitkiləri"),
    Plan(0, 0, 0, S.UNDER_REVIEW, 9, 1_120_000, 31, 24, "Suvarılan buğda və qarğıdalı"),
    Plan(1, 1, 0, S.RECEIVED, 6, 540_000, 17, 18, "Araz vadisində alma bağı"),
    Plan(-1, 1, 1, S.RECEIVED, 2, 850_000, 25, 18, "İntensiv meyvə bağı və damcı suvarma"),
    Plan(2, 2, 0, S.UNDER_REVIEW, 2, 690_000, 14, 12, "Yay otlağında qoyunçuluq"),
]


async def load_applications(
    session: AsyncSession, people: DemoPeople, competitions: list[Competition]
) -> int:
    now = datetime.now(UTC)
    demo_profile = await session.scalar(
        select(Entrepreneur).where(Entrepreneur.user_id == people.entrepreneur.id)
    )
    specialist = people.specialist
    created = 0

    for plan in sorted(PLANS, key=lambda p: -p.days_ago):  # numbers follow submission order
        comp = competitions[plan.competition]
        if plan.lot >= len(comp.areas):
            continue
        lot = comp.areas[plan.lot]
        if plan.applicant < 0:
            user, profile = people.entrepreneur, demo_profile
        else:
            user, profile = people.applicants[plan.applicant]

        submitted = now - timedelta(days=plan.days_ago, hours=3)
        seq = await session.scalar(text("SELECT nextval('application_number_seq')"))
        app = Application(
            number=f"QIM-{submitted.year}-{seq:06d}",
            entrepreneur_id=profile.id,
            competition_id=comp.id,
            farm_area_id=lot.farm_area_id,
            activity=lot.farm_area.purpose,
            project_title=plan.title,
            applicant_snapshot=_snapshot(profile),
            status=plan.status,
            outcome=plan.outcome,
            decision_reason=plan.reason if plan.status == S.DECIDED else None,
            decided_by=specialist.id if plan.status == S.DECIDED else None,
            decided_at=now - timedelta(days=2) if plan.status == S.DECIDED else None,
            submitted_at=submitted,
            created_at=submitted - timedelta(days=1),
            business_plan=BusinessPlan(
                investment_azn=Decimal(plan.investment),
                own_funds_pct=Decimal(35),
                jobs_planned=plan.jobs,
                jobs_local=int(plan.jobs * 0.7),
                implementation_months=plan.months,
                experience_years=5,
                summary=f"{plan.title}. Müasir texnologiya, yerli işçi qüvvəsi və bazar müqavilələri əsasında.",
                products_market="Məhsulun daxili bazarda və ixracda satışı planlaşdırılır.",
                water_plan="Damcı suvarma sistemi və mövcud kanal şəbəkəsindən istifadə.",
            ),
        )
        session.add(app)
        if plan.outcome == Outcome.WON:
            lot.farm_area.status = AreaStatus.ALLOCATED
        await session.flush()

        required = (
            await session.scalars(
                select(CompetitionRequiredDoc).where(
                    CompetitionRequiredDoc.competition_id == comp.id
                )
            )
        ).all()
        for req in required:
            if not req.mandatory or req.document_type.applies_to not in ("ANY", profile.type.value):
                continue
            stored = storage.save(placeholder_pdf(req.doc_type_code.replace("_", " ").title()), 10)
            session.add(
                ApplicationDocument(
                    application_id=app.id,
                    doc_type_code=req.doc_type_code,
                    original_name=f"{req.doc_type_code.lower()}.pdf",
                    stored_name=stored.stored_name,
                    mime=stored.mime,
                    size_bytes=stored.size,
                    sha256=stored.sha256,
                    uploaded_by=user.id,
                    created_at=submitted - timedelta(hours=2),
                )
            )

        steps: list[
            tuple[ApplicationStatus | None, ApplicationStatus, User, str, datetime, Outcome | None]
        ] = [
            (None, S.DRAFT, user, "Qaralama yaradıldı", submitted - timedelta(days=1), None),
            (S.DRAFT, S.RECEIVED, user, "Müraciət elektron qaydada təqdim edildi", submitted, None),
        ]
        if plan.status in (S.UNDER_REVIEW, S.INFO_REQUESTED, S.DECIDED):
            steps.append(
                (
                    S.RECEIVED,
                    S.UNDER_REVIEW,
                    specialist,
                    "Müraciətə baxılmağa başlanıldı",
                    submitted + timedelta(days=1),
                    None,
                )
            )
        if plan.status == S.INFO_REQUESTED:
            asked = submitted + timedelta(days=2)
            steps.append((S.UNDER_REVIEW, S.INFO_REQUESTED, specialist, plan.reason, asked, None))
            session.add(
                InfoRequest(
                    application_id=app.id,
                    requested_by=specialist.id,
                    message=plan.reason,
                    requested_doc_types=["EXPERIENCE"],
                    created_at=asked,
                )
            )
        if plan.status == S.DECIDED:
            steps.append(
                (
                    S.UNDER_REVIEW,
                    S.DECIDED,
                    specialist,
                    plan.reason,
                    now - timedelta(days=2),
                    plan.outcome,
                )
            )
        for from_s, to_s, actor, reason, at, outcome in steps:
            session.add(
                StatusHistory(
                    application_id=app.id,
                    from_status=from_s,
                    to_status=to_s,
                    outcome=outcome,
                    actor_id=actor.id,
                    actor_role=actor.role.value,
                    reason=reason,
                    created_at=at,
                )
            )
        app.last_status_at = steps[-1][4]
        session.add(
            Notification(
                user_id=user.id,
                kind="application_received",
                title_az="Müraciətiniz qəbul edildi",
                body_az=f"{app.number} nömrəli müraciətiniz qeydə alındı və baxılma növbəsinə daxil oldu.",
                link=f"/cabinet/applications/{app.id}",
                application_id=app.id,
                created_at=submitted,
                read_at=submitted + timedelta(hours=1),
            )
        )
        created += 1

    await session.flush()
    return created

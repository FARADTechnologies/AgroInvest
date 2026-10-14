"""Statistics and reports (R5.5). Aggregates only; personal data stays masked."""

import io
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from pydantic import BaseModel
from sqlalchemy import case, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.applications.models import Application, ApplicationStatus, BusinessPlan, Outcome
from app.modules.applications.service import mask
from app.modules.areas.models import AreaStatus, FarmArea, Purpose
from app.modules.competitions.models import Competition, CompetitionArea, CompetitionStatus
from app.modules.entrepreneurs.models import Entrepreneur
from app.modules.geo.models import Rayon

S = ApplicationStatus
STATUS_AZ = {
    "DRAFT": "Qaralama",
    "RECEIVED": "Qəbul edilib",
    "UNDER_REVIEW": "Baxılır",
    "INFO_REQUESTED": "Əlavə məlumat tələb olunur",
    "DECIDED": "Qərar verilib",
}
OUTCOME_AZ = {"WON": "Qalib", "REJECTED": "İmtina"}
PURPOSE_AZ = {
    "CROP": "Əkinçilik",
    "LIVESTOCK": "Heyvandarlıq",
    "ORCHARD": "Bağçılıq",
    "OTHER": "Digər",
}


class RayonStat(BaseModel):
    rayon: str
    areas: int
    hectares: Decimal
    applications: int
    investment_azn: Decimal


class PurposeStat(BaseModel):
    purpose: Purpose
    areas: int
    hectares: Decimal
    applications: int


class DailyStat(BaseModel):
    day: str
    applications: int


class CompetitionStat(BaseModel):
    number: str
    title_az: str
    status: CompetitionStatus
    opens_at: datetime
    deadline_at: datetime
    lots: int
    applications: int


class Stats(BaseModel):
    competitions_open: int
    competitions_total: int
    competitions_pending_approval: int
    areas_offered: int
    hectares_offered: Decimal
    areas_allocated: int
    applications_total: int
    applications_by_status: dict[str, int]
    decided_won: int
    decided_rejected: int
    planned_investment_azn: Decimal
    planned_jobs: int
    local_applicant_share: float
    avg_decision_days: float | None
    by_rayon: list[RayonStat]
    by_purpose: list[PurposeStat]
    daily: list[DailyStat]
    by_competition: list[CompetitionStat]


class PublicStats(BaseModel):
    competitions_open: int
    areas_offered: int
    hectares_offered: Decimal
    applications_total: int
    decisions: int
    planned_investment_azn: Decimal
    planned_jobs: int


def _submitted():
    return Application.status != S.DRAFT


async def compute(session: AsyncSession) -> Stats:
    now = datetime.now(UTC)
    comp_rows = (await session.scalars(select(Competition))).all()
    open_ids = [
        c.id
        for c in comp_rows
        if c.status == CompetitionStatus.PUBLISHED and c.opens_at <= now < c.deadline_at
    ]
    offered = (
        await session.execute(
            select(func.count(FarmArea.id), func.coalesce(func.sum(FarmArea.area_ha), 0))
            .join(CompetitionArea, CompetitionArea.farm_area_id == FarmArea.id)
            .join(Competition, Competition.id == CompetitionArea.competition_id)
            .where(
                Competition.status.in_(
                    (
                        CompetitionStatus.PUBLISHED,
                        CompetitionStatus.CLOSED,
                        CompetitionStatus.RESULTS_ANNOUNCED,
                    )
                )
            )
        )
    ).one()
    allocated = await session.scalar(
        select(func.count(FarmArea.id)).where(FarmArea.status == AreaStatus.ALLOCATED)
    )

    by_status = {s.value: 0 for s in S if s != S.DRAFT}
    for st, n in (
        await session.execute(
            select(Application.status, func.count())
            .where(_submitted())
            .group_by(Application.status)
        )
    ).all():
        by_status[st.value if hasattr(st, "value") else st] = n
    won, rejected = (
        await session.execute(
            select(
                func.count(case((Application.outcome == Outcome.WON, 1))),
                func.count(case((Application.outcome == Outcome.REJECTED, 1))),
            )
        )
    ).one()
    invest, jobs = (
        await session.execute(
            select(
                func.coalesce(func.sum(BusinessPlan.investment_azn), 0),
                func.coalesce(func.sum(BusinessPlan.jobs_planned), 0),
            )
            .join(Application, Application.id == BusinessPlan.application_id)
            .where(_submitted())
        )
    ).one()
    total_apps = sum(by_status.values())
    local = await session.scalar(
        select(func.count(Application.id)).where(
            _submitted(), Application.applicant_snapshot["is_local"].as_boolean().is_(True)
        )
    )
    avg_days = await session.scalar(
        select(
            func.avg(
                func.extract("epoch", Application.decided_at - Application.submitted_at) / 86400
            )
        ).where(Application.decided_at.is_not(None))
    )

    rayon_rows = (
        await session.execute(
            select(
                Rayon.name_az,
                func.count(func.distinct(FarmArea.id)),
                func.coalesce(func.sum(func.distinct(FarmArea.area_ha)), 0),
            )
            .join(FarmArea, FarmArea.rayon_id == Rayon.id)
            .where(
                FarmArea.status.in_(
                    (AreaStatus.IN_COMPETITION, AreaStatus.ALLOCATED, AreaStatus.AVAILABLE)
                )
            )
            .group_by(Rayon.name_az)
        )
    ).all()
    rayon_apps = dict(
        (
            await session.execute(
                select(Rayon.name_az, func.count(Application.id))
                .join(FarmArea, FarmArea.rayon_id == Rayon.id)
                .join(Application, Application.farm_area_id == FarmArea.id)
                .where(_submitted())
                .group_by(Rayon.name_az)
            )
        ).all()
    )
    rayon_inv = dict(
        (
            await session.execute(
                select(Rayon.name_az, func.coalesce(func.sum(BusinessPlan.investment_azn), 0))
                .join(FarmArea, FarmArea.rayon_id == Rayon.id)
                .join(Application, Application.farm_area_id == FarmArea.id)
                .join(BusinessPlan, BusinessPlan.application_id == Application.id)
                .where(_submitted())
                .group_by(Rayon.name_az)
            )
        ).all()
    )
    by_rayon = sorted(
        (
            RayonStat(
                rayon=r,
                areas=a,
                hectares=Decimal(h),
                applications=rayon_apps.get(r, 0),
                investment_azn=Decimal(rayon_inv.get(r, 0)),
            )
            for r, a, h in rayon_rows
        ),
        key=lambda x: (-x.applications, -x.hectares),
    )

    purpose_rows = (
        await session.execute(
            select(
                FarmArea.purpose,
                func.count(FarmArea.id),
                func.coalesce(func.sum(FarmArea.area_ha), 0),
            )
            .where(
                FarmArea.status.in_(
                    (AreaStatus.IN_COMPETITION, AreaStatus.ALLOCATED, AreaStatus.AVAILABLE)
                )
            )
            .group_by(FarmArea.purpose)
        )
    ).all()
    purpose_apps = dict(
        (
            await session.execute(
                select(FarmArea.purpose, func.count(Application.id))
                .join(Application, Application.farm_area_id == FarmArea.id)
                .where(_submitted())
                .group_by(FarmArea.purpose)
            )
        ).all()
    )
    by_purpose = [
        PurposeStat(purpose=p, areas=n, hectares=Decimal(h), applications=purpose_apps.get(p, 0))
        for p, n, h in purpose_rows
    ]

    since = now - timedelta(days=29)
    # A literal time zone, so the GROUP BY expression is identical to the selected one.
    day = func.date(func.timezone(literal_column("'Asia/Baku'"), Application.submitted_at))
    day_rows = dict(
        (
            await session.execute(
                select(day, func.count()).where(Application.submitted_at >= since).group_by(day)
            )
        ).all()
    )
    daily = []
    for i in range(30):
        d = (since + timedelta(days=i)).date()
        daily.append(DailyStat(day=d.isoformat(), applications=day_rows.get(d, 0)))

    comp_apps = dict(
        (
            await session.execute(
                select(Application.competition_id, func.count())
                .where(_submitted())
                .group_by(Application.competition_id)
            )
        ).all()
    )
    comp_lots = dict(
        (
            await session.execute(
                select(CompetitionArea.competition_id, func.count()).group_by(
                    CompetitionArea.competition_id
                )
            )
        ).all()
    )
    by_competition = [
        CompetitionStat(
            number=c.number,
            title_az=c.title_az,
            status=c.status,
            opens_at=c.opens_at,
            deadline_at=c.deadline_at,
            lots=comp_lots.get(c.id, 0),
            applications=comp_apps.get(c.id, 0),
        )
        for c in sorted(comp_rows, key=lambda c: c.number)
    ]

    return Stats(
        competitions_open=len(open_ids),
        competitions_total=len(comp_rows),
        competitions_pending_approval=sum(
            1 for c in comp_rows if c.status == CompetitionStatus.PENDING_APPROVAL
        ),
        areas_offered=offered[0],
        hectares_offered=Decimal(offered[1]),
        areas_allocated=allocated or 0,
        applications_total=total_apps,
        applications_by_status=by_status,
        decided_won=won,
        decided_rejected=rejected,
        planned_investment_azn=Decimal(invest),
        planned_jobs=int(jobs),
        local_applicant_share=(local or 0) / total_apps if total_apps else 0.0,
        avg_decision_days=round(float(avg_days), 1) if avg_days is not None else None,
        by_rayon=by_rayon,
        by_purpose=by_purpose,
        daily=daily,
        by_competition=by_competition,
    )


async def public(session: AsyncSession) -> PublicStats:
    s = await compute(session)
    return PublicStats(
        competitions_open=s.competitions_open,
        areas_offered=s.areas_offered,
        hectares_offered=s.hectares_offered,
        applications_total=s.applications_total,
        decisions=s.decided_won + s.decided_rejected,
        planned_investment_azn=s.planned_investment_azn,
        planned_jobs=s.planned_jobs,
    )


# ── XLSX export ─────────────────────────────────────────────────────────────

HEADER_FILL = PatternFill("solid", fgColor="DCE9E1")
HEADER_FONT = Font(bold=True, color="173C2A")


def _sheet_header(ws, headers: list[str], widths: list[int]) -> None:
    ws.append(headers)
    for i, w in enumerate(widths, start=1):
        cell = ws.cell(row=1, column=i)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 30


def _local(dt: datetime | None) -> datetime | None:
    # Excel has no time zones: write Baku local time without tzinfo.
    return (dt.astimezone(UTC) + timedelta(hours=4)).replace(tzinfo=None) if dt else None


async def applications_xlsx(
    session: AsyncSession, competition_id=None, status: ApplicationStatus | None = None
) -> bytes:
    stmt = (
        select(Application, FarmArea, Rayon.name_az, Competition.number, BusinessPlan, Entrepreneur)
        .join(FarmArea, FarmArea.id == Application.farm_area_id)
        .join(Rayon, Rayon.id == FarmArea.rayon_id)
        .join(Competition, Competition.id == Application.competition_id)
        .join(Entrepreneur, Entrepreneur.id == Application.entrepreneur_id)
        .outerjoin(BusinessPlan, BusinessPlan.application_id == Application.id)
        .where(_submitted())
        .order_by(Application.submitted_at)
    )
    if competition_id:
        stmt = stmt.where(Application.competition_id == competition_id)
    if status:
        stmt = stmt.where(Application.status == status)
    rows = (await session.execute(stmt)).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Müraciətlər"
    _sheet_header(
        ws,
        [
            "Nömrə",
            "Status",
            "Nəticə",
            "Sahibkar",
            "Növ",
            "FİN / VÖEN",
            "Yerli",
            "Sahə",
            "Rayon",
            "Təyinat",
            "Ölçü (ha)",
            "Müsabiqə",
            "İnvestisiya (AZN)",
            "İş yerləri",
            "İcra müddəti (ay)",
            "Göndərilib",
            "Son status",
            "Qərarın səbəbi",
        ],
        [17, 22, 10, 30, 12, 14, 7, 11, 13, 13, 10, 13, 16, 10, 12, 17, 17, 40],
    )
    for app, area, rayon, comp_no, plan, profile in rows:
        snap = app.applicant_snapshot or {}
        company = snap.get("type") == "COMPANY"
        ws.append(
            [
                app.number,
                STATUS_AZ[app.status.value],
                OUTCOME_AZ.get(app.outcome.value) if app.outcome else None,
                snap.get("company_name") or snap.get("full_name") or profile.display_name,
                "Hüquqi şəxs" if company else "Fiziki şəxs",
                mask(snap.get("voen") if company else snap.get("fin")),
                "Bəli" if snap.get("is_local") else "Xeyr",
                area.code,
                rayon,
                PURPOSE_AZ[area.purpose.value],
                float(area.area_ha),
                comp_no,
                float(plan.investment_azn) if plan and plan.investment_azn is not None else None,
                plan.jobs_planned if plan else None,
                plan.implementation_months if plan else None,
                _local(app.submitted_at),
                _local(app.last_status_at),
                app.decision_reason,
            ]
        )
    for row in ws.iter_rows(min_row=2):
        row[10].number_format = "0.0"
        row[12].number_format = "#,##0"
        row[15].number_format = "dd.mm.yyyy hh:mm"
        row[16].number_format = "dd.mm.yyyy hh:mm"
    ws.auto_filter.ref = ws.dimensions

    stats = await compute(session)
    summary = wb.create_sheet("Xülasə")
    _sheet_header(summary, ["Göstərici", "Dəyər"], [44, 20])
    for label, value in [
        ("Hesabatın tarixi (Bakı vaxtı)", _local(datetime.now(UTC))),
        ("Açıq müsabiqələr", stats.competitions_open),
        ("Müsabiqəyə çıxarılan sahələr", stats.areas_offered),
        ("Müsabiqəyə çıxarılan ərazi (ha)", float(stats.hectares_offered)),
        ("Müraciətlər (cəmi)", stats.applications_total),
        *[(f"  {STATUS_AZ[k]}", v) for k, v in stats.applications_by_status.items()],
        ("Qalib", stats.decided_won),
        ("İmtina", stats.decided_rejected),
        ("Planlaşdırılan investisiya (AZN)", float(stats.planned_investment_azn)),
        ("Planlaşdırılan iş yerləri", stats.planned_jobs),
        ("Yerli sahibkarların payı", stats.local_applicant_share),
    ]:
        summary.append([label, value])
    summary["B2"].number_format = "dd.mm.yyyy hh:mm"
    for row in summary.iter_rows(min_row=2):
        if row[0].value == "Yerli sahibkarların payı":
            row[1].number_format = "0%"
        elif isinstance(row[1].value, float):
            row[1].number_format = "#,##0.0" if "ha" in row[0].value else "#,##0"

    by_rayon = wb.create_sheet("Rayonlar üzrə")
    _sheet_header(
        by_rayon,
        ["Rayon", "Sahələr", "Ərazi (ha)", "Müraciətlər", "İnvestisiya (AZN)"],
        [18, 10, 12, 12, 18],
    )
    for r in stats.by_rayon:
        by_rayon.append(
            [r.rayon, r.areas, float(r.hectares), r.applications, float(r.investment_azn)]
        )

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request, Response

from app.core.deps import SessionDep, StaffUser
from app.modules.applications.models import ApplicationStatus
from app.modules.audit import service as audit
from app.modules.reports import service
from app.modules.reports.service import PublicStats, Stats

router = APIRouter(tags=["statistics and reports"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/admin/stats", response_model=Stats, summary="Dashboard figures for staff")
async def stats(user: StaffUser, session: SessionDep) -> Stats:
    return await service.compute(session)


@router.get(
    "/stats/public",
    response_model=PublicStats,
    summary="Aggregate figures for the transparency page",
)
async def public_stats(session: SessionDep) -> PublicStats:
    return await service.public(session)


@router.get(
    "/admin/reports/applications.xlsx",
    summary="Applications report (Excel), FIN/VOEN masked",
    response_class=Response,
)
async def applications_report(
    user: StaffUser,
    session: SessionDep,
    request: Request,
    competition_id: uuid.UUID | None = None,
    status: ApplicationStatus | None = None,
) -> Response:
    data = await service.applications_xlsx(session, competition_id, status)
    audit.record(
        session,
        user,
        "report.export",
        "report",
        "applications.xlsx",
        {
            "competition_id": str(competition_id) if competition_id else None,
            "status": status.value if status else None,
        },
        request.client.host if request.client else None,
    )
    await session.commit()
    # File names use Baku time (UTC+4, no daylight saving) like every date in the portal.
    stamp = (datetime.now(UTC) + timedelta(hours=4)).strftime("%Y%m%d-%H%M")
    return Response(
        content=data,
        media_type=XLSX,
        headers={
            "Content-Disposition": f'attachment; filename="muracietler-{stamp}.xlsx"',
            "Cache-Control": "no-store",
        },
    )

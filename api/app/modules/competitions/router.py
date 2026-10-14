import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import SessionDep
from app.core.errors import not_found
from app.modules.areas.models import Purpose
from app.modules.areas.schemas import RequiredDocOut
from app.modules.competitions.models import Competition, CompetitionStatus
from app.modules.geo.models import Rayon

router = APIRouter(prefix="/competitions", tags=["competitions (public)"])

PUBLIC = (
    CompetitionStatus.PUBLISHED,
    CompetitionStatus.CLOSED,
    CompetitionStatus.RESULTS_ANNOUNCED,
)


class CompetitionSummary(BaseModel):
    id: uuid.UUID
    number: str
    title_az: str
    description_az: str
    status: CompetitionStatus
    opens_at: datetime
    deadline_at: datetime
    is_open: bool
    area_count: int
    total_ha: Decimal


class LotOut(BaseModel):
    lot_no: int
    area_id: uuid.UUID
    code: str
    name_az: str
    rayon_name: str
    area_ha: Decimal
    purpose: Purpose
    min_investment_azn: Decimal | None


class CompetitionDetail(CompetitionSummary):
    conditions_az: str
    lots: list[LotOut]
    required_documents: list[RequiredDocOut]


def _is_open(c: Competition) -> bool:
    now = datetime.now(UTC)
    return c.status == CompetitionStatus.PUBLISHED and c.opens_at <= now < c.deadline_at


def _summary(c: Competition) -> CompetitionSummary:
    return CompetitionSummary(
        id=c.id,
        number=c.number,
        title_az=c.title_az,
        description_az=c.description_az,
        status=c.status,
        opens_at=c.opens_at,
        deadline_at=c.deadline_at,
        is_open=_is_open(c),
        area_count=len(c.areas),
        total_ha=sum((a.farm_area.area_ha for a in c.areas), Decimal(0)),
    )


@router.get("", response_model=list[CompetitionSummary])
async def list_competitions(session: SessionDep) -> list[CompetitionSummary]:
    rows = (
        await session.scalars(
            select(Competition)
            .where(Competition.status.in_(PUBLIC))
            .options(selectinload(Competition.areas))
            .order_by(Competition.deadline_at.desc())
        )
    ).all()
    # Open competitions first (nearest deadline first), then past ones (latest first).
    items = [_summary(c) for c in rows]
    open_items = sorted((s for s in items if s.is_open), key=lambda s: s.deadline_at)
    past_items = [s for s in items if not s.is_open]
    return open_items + past_items


@router.get("/{number}", response_model=CompetitionDetail)
async def competition_detail(number: str, session: SessionDep) -> CompetitionDetail:
    comp = await session.scalar(
        select(Competition)
        .where(func.upper(Competition.number) == number.upper(), Competition.status.in_(PUBLIC))
        .options(selectinload(Competition.areas), selectinload(Competition.required_documents))
    )
    if comp is None:
        raise not_found("Müsabiqə tapılmadı")
    rayon_names = dict((await session.execute(select(Rayon.id, Rayon.name_az))).all())
    lots = [
        LotOut(
            lot_no=ca.lot_no,
            area_id=ca.farm_area.id,
            code=ca.farm_area.code,
            name_az=ca.farm_area.name_az,
            rayon_name=rayon_names.get(ca.farm_area.rayon_id, ""),
            area_ha=ca.farm_area.area_ha,
            purpose=ca.farm_area.purpose,
            min_investment_azn=ca.min_investment_azn,
        )
        for ca in comp.areas
    ]
    docs = [
        RequiredDocOut(
            code=d.doc_type_code,
            name_az=d.document_type.name_az,
            description_az=d.document_type.description_az,
            applies_to=d.document_type.applies_to,
            mandatory=d.mandatory,
        )
        for d in comp.required_documents
    ]
    return CompetitionDetail(
        **_summary(comp).model_dump(),
        conditions_az=comp.conditions_az,
        lots=lots,
        required_documents=docs,
    )

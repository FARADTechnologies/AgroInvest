"""Listings (elanlar): a sahibkar offers a plot to investors.

Placing a listing draws the plot, scores its suitability and publishes it at once as a one-lot
competition, so investors find it in the catalogue and on the map and apply through the usual
application flow. The sahibkar follows the applications to their own listings; the decision on
them stays with the competition commission.
"""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select

from app.core.deps import AdminUser, SessionDep
from app.core.errors import conflict
from app.modules.applications.models import Application, ApplicationStatus, BusinessPlan
from app.modules.areas.admin import NOUN, _derive, _next_code
from app.modules.areas.models import (
    AreaStatus,
    DataSource,
    DeminingStatus,
    FarmArea,
    Irrigation,
    Purpose,
)
from app.modules.audit import service as audit
from app.modules.competitions.models import (
    Competition,
    CompetitionArea,
    CompetitionRequiredDoc,
    CompetitionStatus,
)
from app.modules.competitions.service import is_open, next_number
from app.modules.geo.models import Rayon
from app.modules.suitability import service as suitability

router = APIRouter(prefix="/listings", tags=["listings (sahibkar)"])

# What every investor submits with an application to a listing.
DOCUMENTS = [
    ("BUSINESS_PLAN", True),
    ("FINANCIAL_CAPACITY", True),
    ("TAX_CLEARANCE", True),
    ("ID_CARD", True),
    ("VOEN_CERT", True),
    ("REGISTRY_EXTRACT", True),
    ("EXPERIENCE", False),
]


class ListingIn(BaseModel):
    geometry: dict = Field(description="GeoJSON Polygon or MultiPolygon, WGS84")
    purpose: Purpose
    title_az: str = Field(min_length=5, max_length=200)
    description_az: str = Field(min_length=10, max_length=3000)
    conditions_az: str | None = Field(default=None, max_length=5000)
    lease_term_years: int = Field(ge=1, le=49)
    annual_fee_azn_per_ha: Decimal = Field(ge=0, le=100_000)
    min_investment_azn: Decimal = Field(ge=0, le=10_000_000_000)
    irrigation: Irrigation = Irrigation.NONE
    deadline_at: datetime
    demining_certified_on: date = Field(description="Date of the ANAMA clearance certificate")

    @model_validator(mode="after")
    def check_dates(self) -> "ListingIn":
        if self.deadline_at <= datetime.now(UTC):
            raise ValueError("Son müraciət tarixi gələcəkdə olmalıdır")
        if self.demining_certified_on > date.today():
            raise ValueError("Minatəmizləmə sertifikatının tarixi gələcəkdə ola bilməz")
        return self


class ListingOut(BaseModel):
    competition_id: uuid.UUID
    number: str
    area_code: str
    title_az: str
    purpose: Purpose
    area_ha: Decimal
    rayon_name: str
    min_investment_azn: Decimal | None
    deadline_at: datetime
    open: bool
    applications: int


class ListingApplicationOut(BaseModel):
    id: uuid.UUID
    number: str | None
    investor: str
    area_code: str
    listing_number: str
    activity: Purpose
    investment_azn: Decimal | None
    jobs_planned: int | None
    status: ApplicationStatus
    outcome: str | None
    submitted_at: datetime | None


@router.post(
    "",
    response_model=ListingOut,
    status_code=status.HTTP_201_CREATED,
    summary="Administrator: draw the plot, set the terms and publish it as a listing",
)
async def create_listing(
    data: ListingIn, user: AdminUser, session: SessionDep, request: Request
) -> ListingOut:
    d = await _derive(session, data.geometry)
    overlap = await session.scalar(
        select(FarmArea.code).where(func.ST_Intersects(FarmArea.geom, d["geom"])).limit(1)
    )
    if overlap:
        raise conflict("overlap", f"Sahə portaldakı {overlap} sahəsi ilə üst-üstə düşür")
    rayon: Rayon = d["rayon"]
    area = FarmArea(
        code=await _next_code(session, rayon),
        name_az=data.title_az.strip(),
        rayon_id=rayon.id,
        village_id=d["village_id"],
        geom=d["geom"],
        centroid=d["centroid"],
        area_ha=d["area_ha"],
        purpose=data.purpose,
        conditions_of_use=(data.conditions_az or "").strip()
        or f"Sahə {NOUN[data.purpose.value]} kimi icarəyə verilir. İcarə müddəti {data.lease_term_years} ildir.",
        lease_term_years=data.lease_term_years,
        annual_fee_azn_per_ha=data.annual_fee_azn_per_ha,
        irrigation=data.irrigation,
        dist_village_m=d["dist_village_m"],
        demining_status=DeminingStatus.CLEARED,
        demining_certified_on=data.demining_certified_on,
        status=AreaStatus.IN_COMPETITION,
        data_source=DataSource.LISTING,
        created_by=user.id,
    )
    session.add(area)
    await session.flush()

    now = datetime.now(UTC)
    comp = Competition(
        number=await next_number(session),
        title_az=data.title_az.strip(),
        description_az=data.description_az.strip(),
        conditions_az=area.conditions_of_use,
        opens_at=now,
        deadline_at=data.deadline_at,
        status=CompetitionStatus.PUBLISHED,
        created_by=user.id,
        published_at=now,
    )
    comp.areas.append(
        CompetitionArea(farm_area_id=area.id, lot_no=1, min_investment_azn=data.min_investment_azn)
    )
    for code, mandatory in DOCUMENTS:
        comp.required_documents.append(
            CompetitionRequiredDoc(doc_type_code=code, mandatory=mandatory)
        )
    session.add(comp)
    await session.flush()
    await suitability.refresh(session, [area.id])
    audit.record(
        session,
        user,
        "listing.create",
        "competition",
        str(comp.id),
        {"number": comp.number, "area": area.code, "ha": str(area.area_ha)},
        request.client.host if request.client else None,
    )
    await session.commit()
    return ListingOut(
        competition_id=comp.id,
        number=comp.number,
        area_code=area.code,
        title_az=comp.title_az,
        purpose=area.purpose,
        area_ha=area.area_ha,
        rayon_name=rayon.name_az,
        min_investment_azn=data.min_investment_azn,
        deadline_at=comp.deadline_at,
        open=True,
        applications=0,
    )


_SUBMITTED = Application.status != ApplicationStatus.DRAFT


@router.get("/mine", response_model=list[ListingOut], summary="Administrator: all listings")
async def my_listings(user: AdminUser, session: SessionDep) -> list[ListingOut]:
    counts = dict(
        (
            await session.execute(
                select(Application.competition_id, func.count())
                .where(_SUBMITTED)
                .group_by(Application.competition_id)
            )
        ).all()
    )
    rows = (
        await session.execute(
            select(Competition, CompetitionArea, FarmArea, Rayon.name_az)
            .join(CompetitionArea, CompetitionArea.competition_id == Competition.id)
            .join(FarmArea, FarmArea.id == CompetitionArea.farm_area_id)
            .join(Rayon, Rayon.id == FarmArea.rayon_id)
            .where(FarmArea.data_source == DataSource.LISTING)
            .order_by(Competition.deadline_at.desc(), CompetitionArea.lot_no)
        )
    ).all()
    return [
        ListingOut(
            competition_id=c.id,
            number=c.number,
            area_code=a.code,
            title_az=a.name_az,
            purpose=a.purpose,
            area_ha=a.area_ha,
            rayon_name=rayon,
            min_investment_azn=lot.min_investment_azn,
            deadline_at=c.deadline_at,
            open=is_open(c),
            applications=counts.get(c.id, 0),
        )
        for c, lot, a, rayon in rows
    ]


@router.get(
    "/mine/applications",
    response_model=list[ListingApplicationOut],
    summary="Administrator: applications to the listings",
)
async def my_listing_applications(
    user: AdminUser, session: SessionDep
) -> list[ListingApplicationOut]:
    rows = (
        await session.execute(
            select(Application, Competition.number, FarmArea.code, BusinessPlan)
            .join(Competition, Competition.id == Application.competition_id)
            .join(FarmArea, FarmArea.id == Application.farm_area_id)
            .outerjoin(BusinessPlan, BusinessPlan.application_id == Application.id)
            .where(FarmArea.data_source == DataSource.LISTING, _SUBMITTED)
            .order_by(Application.submitted_at.desc())
        )
    ).all()
    out = []
    for app, number, code, plan in rows:
        snap = app.applicant_snapshot or {}
        out.append(
            ListingApplicationOut(
                id=app.id,
                number=app.number,
                investor=snap.get("company_name") or snap.get("full_name") or "—",
                area_code=code,
                listing_number=number,
                activity=app.activity,
                investment_azn=plan.investment_azn if plan else None,
                jobs_planned=plan.jobs_planned if plan else None,
                status=app.status,
                outcome=app.outcome.value if app.outcome else None,
                submitted_at=app.submitted_at,
            )
        )
    return out

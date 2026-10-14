"""Staff management of farm areas (R5.1).

Geometry arrives as GeoJSON; size, rayon, centroid and the nearest settlement
are always derived on the server with PostGIS, never typed in by hand.
"""

import json
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query, Request, status
from pydantic import BaseModel, Field
from shapely.geometry import shape
from shapely.validation import explain_validity
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import SessionDep, SpecialistUser, StaffUser
from app.core.errors import conflict, not_found, unprocessable
from app.modules.areas.models import (
    AreaStatus,
    DataSource,
    DeminingStatus,
    FarmArea,
    Irrigation,
    Purpose,
)
from app.modules.audit import service as audit
from app.modules.competitions.models import Competition, CompetitionArea, CompetitionStatus
from app.modules.geo.models import CountryOutline, Rayon, Village

router = APIRouter(prefix="/admin/areas", tags=["farm areas (staff)"])

NOUN = {
    "CROP": "əkin sahəsi",
    "ORCHARD": "bağ sahəsi",
    "LIVESTOCK": "otlaq sahəsi",
    "OTHER": "təsərrüfat sahəsi",
}


class AreaInput(BaseModel):
    geometry: dict | None = Field(
        default=None, description="GeoJSON Polygon or MultiPolygon, WGS84"
    )
    name_az: str | None = Field(default=None, max_length=200)
    purpose: Purpose | None = None
    conditions_of_use: str | None = Field(default=None, max_length=5000)
    lease_term_years: int | None = Field(default=None, ge=1, le=99)
    annual_fee_azn_per_ha: Decimal | None = Field(default=None, ge=0)
    irrigation: Irrigation | None = None
    soil_type: str | None = Field(default=None, max_length=120)
    demining_status: DeminingStatus | None = None
    demining_certified_on: date | None = None
    status: AreaStatus | None = Field(default=None, description="DRAFT, AVAILABLE or WITHDRAWN")


class AdminAreaRow(BaseModel):
    id: uuid.UUID
    code: str
    name_az: str
    rayon_name: str
    area_ha: Decimal
    purpose: Purpose
    status: AreaStatus
    demining_status: DeminingStatus
    data_source: DataSource
    competition_number: str | None


class AdminAreaDetail(AdminAreaRow):
    conditions_of_use: str
    lease_term_years: int
    annual_fee_azn_per_ha: Decimal | None
    irrigation: Irrigation
    soil_type: str | None
    demining_certified_on: date | None
    village_name: str | None
    geometry: dict
    editable_geometry: bool


async def _active_competition(session: AsyncSession, area_id: uuid.UUID) -> str | None:
    return await session.scalar(
        select(Competition.number)
        .join(CompetitionArea, CompetitionArea.competition_id == Competition.id)
        .where(
            CompetitionArea.farm_area_id == area_id,
            Competition.status.in_(
                (CompetitionStatus.PENDING_APPROVAL, CompetitionStatus.PUBLISHED)
            ),
        )
    )


async def _derive(session: AsyncSession, geometry: dict) -> dict:
    """Validates the polygon and derives rayon, size, centroid and nearest settlement."""
    try:
        geom = shape(geometry)
    except Exception as exc:  # noqa: BLE001 — any parse failure is a user input error
        raise unprocessable("geometry", "GeoJSON həndəsəsi oxunmadı") from exc
    if geom.geom_type not in ("Polygon", "MultiPolygon"):
        raise unprocessable("geometry", "Həndəsə Polygon və ya MultiPolygon olmalıdır")
    if not geom.is_valid:
        raise unprocessable("geometry", f"Həndəsə düzgün deyil: {explain_validity(geom)}")
    gj = json.dumps(geometry)
    g = func.ST_SetSRID(func.ST_Multi(func.ST_GeomFromGeoJSON(gj)), 4326)
    area_ha = await session.scalar(select(func.ST_Area(func.Geography(g)) / 10_000))
    if not 0.5 <= float(area_ha) <= 5000:
        raise unprocessable(
            "geometry", f"Sahənin ölçüsü {float(area_ha):.1f} ha; 0,5–5000 ha aralığında olmalıdır"
        )
    inside = await session.scalar(select(func.ST_Within(g, CountryOutline.geom)).limit(1))
    if not inside:
        raise unprocessable("geometry", "Sahə Azərbaycan ərazisində olmalıdır")
    rayon = await session.scalar(
        select(Rayon).where(func.ST_Contains(Rayon.geom, func.ST_PointOnSurface(g)))
    )
    if rayon is None:
        raise unprocessable("geometry", "Sahə portalın əhatə etdiyi 14 rayondan birində olmalıdır")
    village = (
        await session.execute(
            select(
                Village.id,
                Village.name_az,
                func.ST_Distance(
                    func.Geography(Village.geom), func.Geography(func.ST_PointOnSurface(g))
                ),
            )
            .where(Village.rayon_id == rayon.id)
            .order_by(func.ST_Distance(Village.geom, func.ST_PointOnSurface(g)))
            .limit(1)
        )
    ).first()
    return {
        "geom": g,
        "centroid": func.ST_PointOnSurface(g),
        "area_ha": Decimal(str(round(float(area_ha), 2))),
        "rayon": rayon,
        "village_id": village[0] if village else None,
        "village_name": village[1] if village else None,
        "dist_village_m": int(village[2]) if village else None,
    }


async def _next_code(session: AsyncSession, rayon: Rayon) -> str:
    codes = (
        await session.scalars(
            select(FarmArea.code).where(FarmArea.code.like(f"{rayon.short_code}-%"))
        )
    ).all()
    n = max((int(c.split("-")[1]) for c in codes), default=0) + 1
    return f"{rayon.short_code}-{n:04d}"


async def _detail(session: AsyncSession, area: FarmArea) -> AdminAreaDetail:
    rayon_name = await session.scalar(select(Rayon.name_az).where(Rayon.id == area.rayon_id))
    village_name = (
        await session.scalar(select(Village.name_az).where(Village.id == area.village_id))
        if area.village_id
        else None
    )
    geometry = json.loads(
        await session.scalar(
            select(func.ST_AsGeoJSON(FarmArea.geom, 6)).where(FarmArea.id == area.id)
        )
    )
    comp = await _active_competition(session, area.id)
    return AdminAreaDetail(
        id=area.id,
        code=area.code,
        name_az=area.name_az,
        rayon_name=rayon_name or "",
        area_ha=area.area_ha,
        purpose=area.purpose,
        status=area.status,
        demining_status=area.demining_status,
        data_source=area.data_source,
        competition_number=comp,
        conditions_of_use=area.conditions_of_use,
        lease_term_years=area.lease_term_years,
        annual_fee_azn_per_ha=area.annual_fee_azn_per_ha,
        irrigation=area.irrigation,
        soil_type=area.soil_type,
        demining_certified_on=area.demining_certified_on,
        village_name=village_name,
        geometry=geometry,
        editable_geometry=comp is None
        and area.status not in (AreaStatus.IN_COMPETITION, AreaStatus.ALLOCATED),
    )


@router.get("", response_model=list[AdminAreaRow])
async def list_areas(
    user: StaffUser,
    session: SessionDep,
    status: AreaStatus | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> list[AdminAreaRow]:
    stmt = (
        select(FarmArea, Rayon.name_az)
        .join(Rayon, Rayon.id == FarmArea.rayon_id)
        .order_by(FarmArea.code)
    )
    if status:
        stmt = stmt.where(FarmArea.status == status)
    if q and q.strip():
        stmt = stmt.where(
            func.az_fold(func.concat_ws(" ", FarmArea.code, FarmArea.name_az, Rayon.name_az)).like(
                func.az_fold(f"%{q.strip()}%")
            )
        )
    rows = (await session.execute(stmt)).all()
    comps = dict(
        (
            await session.execute(
                select(CompetitionArea.farm_area_id, Competition.number)
                .join(Competition, Competition.id == CompetitionArea.competition_id)
                .where(
                    Competition.status.in_(
                        (
                            CompetitionStatus.PENDING_APPROVAL,
                            CompetitionStatus.PUBLISHED,
                            CompetitionStatus.CLOSED,
                        )
                    )
                )
            )
        ).all()
    )
    return [
        AdminAreaRow(
            id=a.id,
            code=a.code,
            name_az=a.name_az,
            rayon_name=r,
            area_ha=a.area_ha,
            purpose=a.purpose,
            status=a.status,
            demining_status=a.demining_status,
            data_source=a.data_source,
            competition_number=comps.get(a.id),
        )
        for a, r in rows
    ]


@router.get("/{area_id}", response_model=AdminAreaDetail)
async def get_area(area_id: uuid.UUID, user: StaffUser, session: SessionDep) -> AdminAreaDetail:
    area = await session.get(FarmArea, area_id)
    if area is None:
        raise not_found("Sahə tapılmadı")
    return await _detail(session, area)


@router.post(
    "",
    response_model=AdminAreaDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Add a farm area from a GeoJSON polygon",
)
async def create_area(
    data: AreaInput, user: SpecialistUser, session: SessionDep, request: Request
) -> AdminAreaDetail:
    if data.geometry is None or data.purpose is None:
        raise unprocessable("required", "Həndəsə və təyinat tələb olunur")
    d = await _derive(session, data.geometry)
    rayon: Rayon = d["rayon"]
    area = FarmArea(
        code=await _next_code(session, rayon),
        name_az=(data.name_az or "").strip()
        or f"{d['village_name'] or rayon.name_az} {NOUN[data.purpose.value]}",
        rayon_id=rayon.id,
        village_id=d["village_id"],
        geom=d["geom"],
        centroid=d["centroid"],
        area_ha=d["area_ha"],
        purpose=data.purpose,
        conditions_of_use=(data.conditions_of_use or "").strip()
        or "İstifadə şərtləri müsabiqə elanında göstəriləcək.",
        lease_term_years=data.lease_term_years or 25,
        annual_fee_azn_per_ha=data.annual_fee_azn_per_ha,
        irrigation=data.irrigation or Irrigation.NONE,
        soil_type=data.soil_type,
        dist_village_m=d["dist_village_m"],
        demining_status=data.demining_status or DeminingStatus.NOT_SURVEYED,
        demining_certified_on=data.demining_certified_on,
        status=data.status
        if data.status in (AreaStatus.DRAFT, AreaStatus.AVAILABLE)
        else AreaStatus.AVAILABLE,
        data_source=DataSource.MANUAL,
        created_by=user.id,
    )
    session.add(area)
    await session.flush()
    audit.record(
        session,
        user,
        "area.create",
        "farm_area",
        str(area.id),
        {"code": area.code, "ha": str(area.area_ha)},
        request.client.host if request.client else None,
    )
    await session.commit()
    await session.refresh(area)
    return await _detail(session, area)


@router.patch("/{area_id}", response_model=AdminAreaDetail, summary="Edit a farm area")
async def update_area(
    area_id: uuid.UUID, data: AreaInput, user: SpecialistUser, session: SessionDep, request: Request
) -> AdminAreaDetail:
    area = await session.get(FarmArea, area_id)
    if area is None:
        raise not_found("Sahə tapılmadı")
    comp = await _active_competition(session, area.id)
    locked = comp is not None or area.status in (AreaStatus.IN_COMPETITION, AreaStatus.ALLOCATED)
    changes = data.model_dump(exclude_unset=True)
    if locked and (
        {"geometry", "purpose"} & changes.keys() or changes.get("status") == AreaStatus.WITHDRAWN
    ):
        raise conflict(
            "area_locked",
            f"Sahə {comp or 'müsabiqədə'}: həndəsə, təyinat və status dəyişdirilə bilməz",
        )
    if data.geometry is not None:
        d = await _derive(session, data.geometry)
        if d["rayon"].id != area.rayon_id:
            raise unprocessable("geometry", "Yeni həndəsə sahənin rayonundan kənara çıxmamalıdır")
        area.geom, area.centroid, area.area_ha = d["geom"], d["centroid"], d["area_ha"]
        area.village_id, area.dist_village_m = d["village_id"], d["dist_village_m"]
    for key in (
        "name_az",
        "purpose",
        "conditions_of_use",
        "lease_term_years",
        "annual_fee_azn_per_ha",
        "irrigation",
        "soil_type",
        "demining_status",
        "demining_certified_on",
    ):
        if key in changes and changes[key] is not None:
            setattr(area, key, changes[key])
    if data.status in (AreaStatus.DRAFT, AreaStatus.AVAILABLE, AreaStatus.WITHDRAWN):
        area.status = data.status
    audit.record(
        session,
        user,
        "area.update",
        "farm_area",
        str(area.id),
        {"code": area.code, "fields": sorted(changes)},
        request.client.host if request.client else None,
    )
    await session.commit()
    await session.refresh(area)
    return await _detail(session, area)

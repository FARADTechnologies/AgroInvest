import json
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import SessionDep
from app.core.errors import not_found
from app.modules.areas import service
from app.modules.areas.models import AreaSuitability, Purpose
from app.modules.areas.schemas import AreaDetail, AreaPage, AreaSort, RequiredDocOut, SuitabilityOut
from app.modules.competitions.models import CompetitionRequiredDoc

router = APIRouter(prefix="/areas", tags=["farm areas (public)"])


def _filters(
    purpose: Annotated[
        list[Purpose] | None, Query(description="Təyinat; repeat for several")
    ] = None,
    region: Annotated[str | None, Query(description="Region code, e.g. KARABAKH")] = None,
    rayon_id: int | None = None,
    min_ha: Annotated[float | None, Query(ge=0)] = None,
    max_ha: Annotated[float | None, Query(ge=0)] = None,
    open_only: bool = False,
    q: Annotated[
        str | None, Query(max_length=100, description="Code, name, rayon or village")
    ] = None,
) -> service.AreaFilters:
    return service.AreaFilters(
        purposes=purpose,
        region=region,
        rayon_id=rayon_id,
        min_ha=min_ha,
        max_ha=max_ha,
        open_only=open_only,
        q=q,
    )


@router.get("", response_model=AreaPage, summary="Catalogue of farm areas with filters and search")
async def list_areas(
    session: SessionDep,
    purpose: Annotated[list[Purpose] | None, Query()] = None,
    region: str | None = None,
    rayon_id: int | None = None,
    min_ha: Annotated[float | None, Query(ge=0)] = None,
    max_ha: Annotated[float | None, Query(ge=0)] = None,
    open_only: bool = False,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: AreaSort = AreaSort.DEADLINE,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AreaPage:
    f = _filters(purpose, region, rayon_id, min_ha, max_ha, open_only, q)
    items, total, counts = await service.list_areas(session, f, sort, page, size)
    return AreaPage(items=items, total=total, page=page, size=size, purpose_counts=counts)


@router.get("/geojson", summary="Farm areas as GeoJSON for the map (same filters)")
async def areas_geojson(
    session: SessionDep,
    purpose: Annotated[list[Purpose] | None, Query()] = None,
    region: str | None = None,
    rayon_id: int | None = None,
    min_ha: Annotated[float | None, Query(ge=0)] = None,
    max_ha: Annotated[float | None, Query(ge=0)] = None,
    open_only: bool = False,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> dict:
    f = _filters(purpose, region, rayon_id, min_ha, max_ha, open_only, q)
    return await service.area_features(session, f)


@router.get("/{code}", response_model=AreaDetail, summary="Farm area detail page data")
async def area_detail(code: str, session: SessionDep) -> AreaDetail:
    row = await service.get_area_row(session, code)
    if row is None:
        raise not_found("Sahə tapılmadı")
    area, rayon_name, region_code, village_name, lon, lat, geom = row
    comps = await service.competitions_for(session, [area.id])
    comp = comps.get(area.id)
    base = service.to_list_item(area, rayon_name, region_code, village_name, lon, lat, comp, None)

    required: list[RequiredDocOut] = []
    min_inv = None
    if comp:
        docs = (
            await session.scalars(
                select(CompetitionRequiredDoc).where(
                    CompetitionRequiredDoc.competition_id == comp.id
                )
            )
        ).all()
        required = [
            RequiredDocOut(
                code=d.doc_type_code,
                name_az=d.document_type.name_az,
                description_az=d.document_type.description_az,
                applies_to=d.document_type.applies_to,
                mandatory=d.mandatory,
            )
            for d in docs
        ]
        min_inv = await service.min_investment(session, area.id, comp.id)

    suit_rows = (
        await session.scalars(
            select(AreaSuitability).where(AreaSuitability.farm_area_id == area.id)
        )
    ).all()
    suitability = sorted(
        (SuitabilityOut.model_validate(s, from_attributes=True) for s in suit_rows),
        key=lambda s: -s.score,
    )
    data = base.model_dump()
    data["best_fao_class"] = min((s.fao_class for s in suitability), default=None)
    return AreaDetail(
        **data,
        conditions_of_use=area.conditions_of_use,
        lease_term_years=area.lease_term_years,
        annual_fee_azn_per_ha=area.annual_fee_azn_per_ha,
        soil_type=area.soil_type,
        dist_water_m=area.dist_water_m,
        dist_road_m=area.dist_road_m,
        dist_village_m=area.dist_village_m,
        elevation_m=area.elevation_m,
        slope_deg=area.slope_deg,
        demining_certified_on=area.demining_certified_on,
        geometry=json.loads(geom),
        min_investment_azn=min_inv,
        required_documents=required,
        suitability=suitability,
    )

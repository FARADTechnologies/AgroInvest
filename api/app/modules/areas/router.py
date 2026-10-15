import json
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.core.deps import SessionDep
from app.core.errors import not_found
from app.modules.areas import decision, service
from app.modules.areas.models import AreaSuitability, Purpose
from app.modules.areas.schemas import (
    AreaDetail,
    AreaPage,
    AreaSort,
    CriterionOut,
    CriterionValue,
    RankedArea,
    RankOut,
    RankRequest,
    RequiredDocOut,
    SuitabilityOut,
)
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
    fee_min: float | None = None,
    fee_max: float | None = None,
    inv_min: float | None = None,
    inv_max: float | None = None,
) -> service.AreaFilters:
    return service.AreaFilters(
        purposes=purpose,
        region=region,
        rayon_id=rayon_id,
        min_ha=min_ha,
        max_ha=max_ha,
        open_only=open_only,
        q=q,
        fee_min=fee_min,
        fee_max=fee_max,
        inv_min=inv_min,
        inv_max=inv_max,
    )


# Maliyyə şərtləri: the annual lease fee per hectare and the minimum investment of the lot.
FeeMin = Annotated[float | None, Query(ge=0, description="Annual lease fee from, AZN/ha")]
FeeMax = Annotated[float | None, Query(ge=0, description="Annual lease fee to, AZN/ha")]
InvMin = Annotated[float | None, Query(ge=0, description="Minimum investment from, AZN")]
InvMax = Annotated[float | None, Query(ge=0, description="Minimum investment to, AZN")]


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
    fee_min: FeeMin = None,
    fee_max: FeeMax = None,
    inv_min: InvMin = None,
    inv_max: InvMax = None,
    sort: AreaSort = AreaSort.DEADLINE,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AreaPage:
    f = _filters(
        purpose, region, rayon_id, min_ha, max_ha, open_only, q, fee_min, fee_max, inv_min, inv_max
    )
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
    fee_min: FeeMin = None,
    fee_max: FeeMax = None,
    inv_min: InvMin = None,
    inv_max: InvMax = None,
) -> dict:
    f = _filters(
        purpose, region, rayon_id, min_ha, max_ha, open_only, q, fee_min, fee_max, inv_min, inv_max
    )
    return await service.area_features(session, f)


@router.get(
    "/compare",
    response_model=list[AreaDetail],
    summary="Side-by-side data for up to three areas (R2.4)",
)
async def compare(
    session: SessionDep,
    codes: Annotated[str, Query(description="Comma-separated area codes, at most 3")],
) -> list[AreaDetail]:
    wanted = [c.strip().upper() for c in codes.split(",") if c.strip()][:3]
    return [await area_detail(code, session) for code in wanted]


def _num(value: float, decimals: int = 0) -> str:
    """Azerbaijani number format: 1 234,5."""
    text = f"{value:,.{decimals}f}".replace(",", " ").replace(".", ",")
    return text


def _lower(text: str) -> str:
    """Lower case for Azerbaijani: Python's lower() turns İ into i plus a combining dot."""
    return text.replace("İ", "i").replace("I", "ı").lower()


def _display(key: str, value: float | None) -> str:
    if value is None:
        return "məlumat yoxdur"
    if key == "suitability":
        return f"{_num(value)}/100"
    if key == "fee":
        return f"{_num(value)} AZN/ha"
    if key == "investment":
        return f"{_num(value)} AZN"
    return f"{_num(value, 1)} km"


@router.post(
    "/compare/rank",
    response_model=RankOut,
    summary="Rank the compared areas with TOPSIS for one activity (decision support)",
)
async def compare_rank(data: RankRequest, session: SessionDep) -> RankOut:
    codes = list(dict.fromkeys(c.strip().upper() for c in data.codes))
    areas = [await area_detail(code, session) for code in codes]
    alternatives = []
    for a in areas:
        suit = next((s for s in a.suitability if s.activity == data.activity), None)
        alternatives.append(
            decision.Alternative(
                code=a.code,
                values={
                    "suitability": suit.score if suit else None,
                    "fee": float(a.annual_fee_azn_per_ha) if a.annual_fee_azn_per_ha else None,
                    "investment": float(a.min_investment_azn) if a.min_investment_azn else None,
                    "water": a.dist_water_m / 1000 if a.dist_water_m is not None else None,
                    "road": a.dist_road_m / 1000 if a.dist_road_m is not None else None,
                },
                excluded_reason=suit.constraint_reason if suit else None,
            )
        )
    weights = (
        decision.PRESETS[data.preset]
        if data.preset
        else (data.weights or decision.PRESETS["balanced"])
    )
    result = decision.rank(alternatives, weights)

    names = {a.code: a.name_az for a in areas}
    ranking = [
        RankedArea(code=c, name_az=names[c], rank=i + 1, closeness=round(result.closeness[c], 3))
        for i, c in enumerate(result.ranking)
    ] + [
        RankedArea(
            code=a.code,
            name_az=names[a.code],
            rank=None,
            closeness=None,
            excluded_reason=a.excluded_reason,
        )
        for a in alternatives
        if a.excluded_reason
    ]
    by_code = {a.code: a for a in alternatives}
    criteria = [
        CriterionOut(
            key=key,
            label=c["label"],
            unit=c["unit"],
            benefit=c["benefit"],
            weight=round(result.weights[key], 3),
            values={
                code: CriterionValue(
                    raw=by_code[code].values[key],
                    display=_display(key, by_code[code].values[key]),
                    score=result.scores.get(key, {}).get(code),
                    best=result.scores.get(key, {}).get(code) == 1.0,
                    imputed=key in result.imputed.get(code, []),
                )
                for code in codes
            },
        )
        for key, c in decision.CRITERIA.items()
    ]
    return RankOut(
        activity=data.activity,
        weights={k: round(v, 3) for k, v in result.weights.items()},
        ranking=ranking,
        criteria=criteria,
        explanation=_explain(result, criteria),
        stability=round(result.stability, 3),
        stable=result.stability >= decision.STABLE_SHARE,
        note=(
            "Qərar dəstəyi: şəffaf çoxmeyarlı üsul (TOPSIS), çəkiləri siz seçirsiniz. Maşın öyrənməsi "
            "istifadə olunmur, çünki keçmiş bölgülərin nəticələri barədə məlumat yoxdur. Yekun qərarı "
            "sahibkar və müsabiqə komissiyası verir."
        ),
    )


def _explain(result: decision.Result, criteria: list[CriterionOut]) -> list[str]:
    lines = list(result.notes)
    if len(result.ranking) < 2:
        return lines + ["Müqayisə üçün ən azı iki uyğun sahə lazımdır."]
    top, second = result.ranking[0], result.ranking[1]
    ordered = sorted(criteria, key=lambda c: -c.weight)
    strengths = [_lower(c.label) for c in ordered if c.values[top].best][:2]
    weakest = min(
        ordered, key=lambda c: c.values[top].score if c.values[top].score is not None else 1
    )
    line = f"{top} birinci yerdədir (yaxınlıq əmsalı {_num(result.closeness[top], 2)})"
    line += f": {' və '.join(strengths)} üzrə ən yaxşı göstərici." if strengths else "."
    if weakest.values[top].score is not None and weakest.values[top].score < 0.5:
        line += f" Zəif tərəfi: {_lower(weakest.label)} ({weakest.values[top].display})."
    lines.append(line)
    if result.closeness[top] - result.closeness[second] < 0.05:
        lines.append(f"{top} ilə {second} arasında fərq kiçikdir; çəkiləri dəyişərək yoxlayın.")
    share = round(result.stability * 100)
    lines.append(f"Çəkilər ±20% dəyişdikdə ssenarilərin {share}%-də {top} birinci qalır.")
    for code, keys in result.imputed.items():
        for key in keys:
            label = _lower(decision.CRITERIA[key]["label"])
            lines.append(f"{code}: {label} məlumatı yoxdur, ən pis məlum dəyər götürülüb.")
    return lines


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
    data["min_investment_azn"] = min_inv
    return AreaDetail(
        **data,
        conditions_of_use=area.conditions_of_use,
        lease_term_years=area.lease_term_years,
        soil_type=area.soil_type,
        dist_water_m=area.dist_water_m,
        dist_road_m=area.dist_road_m,
        dist_village_m=area.dist_village_m,
        elevation_m=area.elevation_m,
        slope_deg=area.slope_deg,
        demining_certified_on=area.demining_certified_on,
        geometry=json.loads(geom),
        required_documents=required,
        suitability=suitability,
    )

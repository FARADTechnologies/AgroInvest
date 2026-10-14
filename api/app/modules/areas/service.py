"""Public queries over farm areas: filtering, search, map features and detail."""

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Select, and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.areas.models import AreaStatus, AreaSuitability, FarmArea, Purpose
from app.modules.areas.schemas import AreaListItem, AreaSort, CompetitionRef
from app.modules.competitions.models import Competition, CompetitionArea, CompetitionStatus
from app.modules.geo.models import Rayon, Region, Village

PUBLIC_STATUSES = (AreaStatus.AVAILABLE, AreaStatus.IN_COMPETITION, AreaStatus.ALLOCATED)
VISIBLE_COMPETITIONS = (
    CompetitionStatus.PUBLISHED,
    CompetitionStatus.CLOSED,
    CompetitionStatus.RESULTS_ANNOUNCED,
)


def az_fold(value):
    """Search key that ignores case and Azerbaijani diacritics (Ağdam == agdam)."""
    return func.az_fold(value)


@dataclass
class AreaFilters:
    purposes: list[Purpose] | None = None
    region: str | None = None
    rayon_id: int | None = None
    min_ha: float | None = None
    max_ha: float | None = None
    open_only: bool = False
    q: str | None = None
    fee_min: float | None = None  # annual lease fee, AZN per hectare
    fee_max: float | None = None
    inv_min: float | None = None  # minimum investment of the area's lot, AZN
    inv_max: float | None = None


def _open_competition_clause():
    now = func.now()
    return exists().where(
        CompetitionArea.farm_area_id == FarmArea.id,
        CompetitionArea.competition_id == Competition.id,
        Competition.status == CompetitionStatus.PUBLISHED,
        Competition.opens_at <= now,
        Competition.deadline_at > now,
    )


def _apply(stmt: Select, f: AreaFilters, *, include_purpose: bool = True) -> Select:
    stmt = stmt.where(FarmArea.status.in_(PUBLIC_STATUSES))
    if include_purpose and f.purposes:
        stmt = stmt.where(FarmArea.purpose.in_(f.purposes))
    if f.region:
        stmt = stmt.where(Region.code == f.region)
    if f.rayon_id:
        stmt = stmt.where(FarmArea.rayon_id == f.rayon_id)
    if f.min_ha is not None:
        stmt = stmt.where(FarmArea.area_ha >= f.min_ha)
    if f.max_ha is not None:
        stmt = stmt.where(FarmArea.area_ha <= f.max_ha)
    if f.open_only:
        stmt = stmt.where(_open_competition_clause())
    if f.fee_min is not None:
        stmt = stmt.where(FarmArea.annual_fee_azn_per_ha >= f.fee_min)
    if f.fee_max is not None:
        stmt = stmt.where(FarmArea.annual_fee_azn_per_ha <= f.fee_max)
    if f.inv_min is not None or f.inv_max is not None:
        # Only areas offered in a public competition have a minimum investment.
        lot = [
            CompetitionArea.farm_area_id == FarmArea.id,
            CompetitionArea.competition_id == Competition.id,
            Competition.status.in_(VISIBLE_COMPETITIONS),
        ]
        if f.inv_min is not None:
            lot.append(CompetitionArea.min_investment_azn >= f.inv_min)
        if f.inv_max is not None:
            lot.append(CompetitionArea.min_investment_azn <= f.inv_max)
        stmt = stmt.where(exists().where(*lot))
    if f.q and f.q.strip():
        q = f.q.strip()
        haystack = az_fold(
            func.concat_ws(" ", FarmArea.code, FarmArea.name_az, Rayon.name_az, Village.name_az)
        )
        # Substring match without diacritics, or a close spelling (pg_trgm): "Fizuli" finds Füzuli.
        stmt = stmt.where(
            or_(
                haystack.like(az_fold(f"%{q}%")),
                func.word_similarity(az_fold(q), haystack) >= 0.4,
            )
        )
    return stmt


def _base_from(stmt: Select) -> Select:
    return (
        stmt.select_from(FarmArea)
        .join(Rayon, Rayon.id == FarmArea.rayon_id)
        .join(Region, Region.id == Rayon.region_id)
        .outerjoin(Village, Village.id == FarmArea.village_id)
    )


def _next_deadline():
    """Earliest open deadline of the area, used for sorting."""
    now = func.now()
    return (
        select(func.min(Competition.deadline_at))
        .join(CompetitionArea, CompetitionArea.competition_id == Competition.id)
        .where(
            CompetitionArea.farm_area_id == FarmArea.id,
            Competition.status == CompetitionStatus.PUBLISHED,
            Competition.deadline_at > now,
        )
        .correlate(FarmArea)
        .scalar_subquery()
    )


async def competitions_for(
    session: AsyncSession, area_ids: list[uuid.UUID]
) -> dict[uuid.UUID, CompetitionRef]:
    """The most relevant public competition per area: the open one, else the latest."""
    if not area_ids:
        return {}
    rows = (
        await session.execute(
            select(CompetitionArea.farm_area_id, Competition)
            .join(Competition, Competition.id == CompetitionArea.competition_id)
            .where(
                CompetitionArea.farm_area_id.in_(area_ids),
                Competition.status.in_(VISIBLE_COMPETITIONS),
            )
            .order_by(Competition.deadline_at.desc())
        )
    ).all()
    now = datetime.now(UTC)
    result: dict[uuid.UUID, CompetitionRef] = {}
    for area_id, comp in rows:
        is_open = (
            comp.status == CompetitionStatus.PUBLISHED and comp.opens_at <= now < comp.deadline_at
        )
        ref = CompetitionRef(
            id=comp.id,
            number=comp.number,
            title_az=comp.title_az,
            deadline_at=comp.deadline_at,
            is_open=is_open,
        )
        current = result.get(area_id)
        if current is None or (is_open and not current.is_open):
            result[area_id] = ref
    return result


async def best_classes(session: AsyncSession, area_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not area_ids:
        return {}
    rows = (
        await session.execute(
            select(AreaSuitability.farm_area_id, func.min(AreaSuitability.fao_class))
            .where(AreaSuitability.farm_area_id.in_(area_ids))
            .group_by(AreaSuitability.farm_area_id)
        )
    ).all()
    # "N" sorts after "S1".."S3", so min() is the best class.
    return dict(rows)


async def list_areas(
    session: AsyncSession, f: AreaFilters, sort: AreaSort, page: int, size: int
) -> tuple[list[AreaListItem], int, dict[str, int]]:
    columns = select(
        FarmArea,
        Rayon.name_az,
        Region.code,
        Village.name_az,
        func.ST_X(FarmArea.centroid),
        func.ST_Y(FarmArea.centroid),
    )
    stmt = _apply(_base_from(columns), f)
    total = await session.scalar(_apply(_base_from(select(func.count(FarmArea.id))), f))

    order = {
        AreaSort.DEADLINE: [_next_deadline().asc().nulls_last(), FarmArea.code],
        AreaSort.AREA_DESC: [FarmArea.area_ha.desc()],
        AreaSort.AREA_ASC: [FarmArea.area_ha.asc()],
        AreaSort.CODE: [FarmArea.code],
    }[sort]
    rows = (
        await session.execute(stmt.order_by(*order).offset((page - 1) * size).limit(size))
    ).all()

    counts_rows = (
        await session.execute(
            _apply(
                _base_from(select(FarmArea.purpose, func.count(FarmArea.id))),
                f,
                include_purpose=False,
            ).group_by(FarmArea.purpose)
        )
    ).all()
    purpose_counts = {p.value: 0 for p in Purpose}
    purpose_counts.update({p.value if hasattr(p, "value") else p: n for p, n in counts_rows})

    ids = [row[0].id for row in rows]
    comps = await competitions_for(session, ids)
    classes = await best_classes(session, ids)
    investments = await lot_investments(session, comps)
    items = [
        to_list_item(
            area,
            rayon,
            region,
            village,
            lon,
            lat,
            comps.get(area.id),
            classes.get(area.id),
            investments.get(area.id),
        )
        for area, rayon, region, village, lon, lat in rows
    ]
    return items, total or 0, purpose_counts


def to_list_item(
    area, rayon_name, region_code, village_name, lon, lat, comp, best, min_investment=None
) -> AreaListItem:
    return AreaListItem(
        id=area.id,
        code=area.code,
        name_az=area.name_az,
        rayon_id=area.rayon_id,
        rayon_name=rayon_name,
        region_code=region_code,
        village_name=village_name,
        area_ha=area.area_ha,
        purpose=area.purpose,
        status=area.status,
        irrigation=area.irrigation,
        demining_status=area.demining_status,
        data_source=area.data_source,
        centroid=[round(lon, 6), round(lat, 6)],
        competition=comp,
        best_fao_class=best,
        annual_fee_azn_per_ha=area.annual_fee_azn_per_ha,
        min_investment_azn=min_investment,
    )


async def area_features(session: AsyncSession, f: AreaFilters) -> dict:
    """GeoJSON for the map with the few properties the map needs."""
    stmt = _apply(
        _base_from(
            select(
                FarmArea.id,
                FarmArea.code,
                FarmArea.purpose,
                FarmArea.area_ha,
                FarmArea.demining_status,
                Rayon.name_az,
                Village.name_az,
                func.ST_AsGeoJSON(FarmArea.geom, 6),
            )
        ),
        f,
    )
    rows = (await session.execute(stmt)).all()
    ids = [r[0] for r in rows]
    comps = await competitions_for(session, ids)
    classes = await best_classes(session, ids)
    features = []
    for area_id, code, purpose, area_ha, demining, rayon_name, village_name, geom in rows:
        comp = comps.get(area_id)
        features.append(
            {
                "type": "Feature",
                "id": code,
                "properties": {
                    "id": str(area_id),
                    "code": code,
                    "purpose": purpose.value if hasattr(purpose, "value") else purpose,
                    "area_ha": float(area_ha),
                    "rayon": rayon_name,
                    "village": village_name,
                    "open": bool(comp and comp.is_open),
                    "deadline_at": comp.deadline_at.isoformat() if comp else None,
                    "fao_class": classes.get(area_id),
                    "demining": demining.value if hasattr(demining, "value") else demining,
                },
                "geometry": json.loads(geom),
            }
        )
    return {"type": "FeatureCollection", "features": features}


async def get_area_row(session: AsyncSession, code: str):
    stmt = _base_from(
        select(
            FarmArea,
            Rayon.name_az,
            Region.code,
            Village.name_az,
            func.ST_X(FarmArea.centroid),
            func.ST_Y(FarmArea.centroid),
            func.ST_AsGeoJSON(FarmArea.geom, 6),
        )
    ).where(FarmArea.code == code.upper(), FarmArea.status.in_(PUBLIC_STATUSES))
    return (await session.execute(stmt)).first()


async def lot_investments(
    session: AsyncSession, comps: dict[uuid.UUID, CompetitionRef]
) -> dict[uuid.UUID, Decimal]:
    """Minimum investment of each area's lot in the competition shown for it."""
    if not comps:
        return {}
    rows = (
        await session.execute(
            select(
                CompetitionArea.farm_area_id,
                CompetitionArea.competition_id,
                CompetitionArea.min_investment_azn,
            ).where(CompetitionArea.farm_area_id.in_(list(comps)))
        )
    ).all()
    return {
        area_id: amount
        for area_id, comp_id, amount in rows
        if amount is not None and comps[area_id].id == comp_id
    }


async def min_investment(
    session: AsyncSession, area_id: uuid.UUID, competition_id: uuid.UUID
) -> Decimal | None:
    return await session.scalar(
        select(CompetitionArea.min_investment_azn).where(
            and_(
                CompetitionArea.farm_area_id == area_id,
                CompetitionArea.competition_id == competition_id,
            )
        )
    )

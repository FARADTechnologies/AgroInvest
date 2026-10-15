"""Scores farm areas with the active method version and keeps the results current.

Distances to water, roads and settlements are measured in PostGIS against the OpenStreetMap
layers, and land cover comes from the plot's own OSM tags; soil, climate and terrain come from
the configured sources (`sources.py`). Every factor is stored with its value, membership,
weight, contribution and source tag, so the breakdown on the area page needs no recomputation.
"""

import uuid

from sqlalchemy import ARRAY, Uuid, bindparam, delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.areas.models import AreaSuitability, DataSource, DeminingStatus, FarmArea, Purpose
from app.modules.suitability import model, sources
from app.modules.suitability.models import SuitabilityMethod

DEFAULT_VERSION = "mcda-2"

LANDCOVER_LABEL = {
    Purpose.CROP: "Əkin sahəsi (OSM)",
    Purpose.ORCHARD: "Bağ və ya üzümlük (OSM)",
    Purpose.LIVESTOCK: "Çəmənlik (OSM)",
    Purpose.OTHER: "Kənd təsərrüfatı sahəsi (OSM)",
}

# Nearest few features by the index operator, then the exact geodesic distance in metres.
_DISTANCES = text(
    """
    SELECT a.id,
      (SELECT min(ST_Distance(f.geom::geography, a.geom::geography)) FROM (
         SELECT geom FROM geo_feature WHERE kind = 'WATER' AND subtype <> 'stream'
         ORDER BY geom <-> a.geom LIMIT 8) f) AS irrigation_m,
      (SELECT min(ST_Distance(f.geom::geography, a.geom::geography)) FROM (
         SELECT geom FROM geo_feature WHERE kind = 'WATER'
         ORDER BY geom <-> a.geom LIMIT 8) f) AS any_water_m,
      (SELECT min(ST_Distance(f.geom::geography, a.geom::geography)) FROM (
         SELECT geom FROM geo_feature WHERE kind = 'ROAD'
         ORDER BY geom <-> a.geom LIMIT 8) f) AS road_m
    FROM farm_area a
    WHERE a.id = ANY(:ids)
    """
).bindparams(bindparam("ids", type_=ARRAY(Uuid)))


async def active_method(session: AsyncSession) -> SuitabilityMethod:
    """The method in force; the built-in default is stored on first use."""
    method = await session.scalar(select(SuitabilityMethod).where(SuitabilityMethod.active))
    if method is None:
        method = SuitabilityMethod(
            version=DEFAULT_VERSION,
            matrices=model.default_method(),
            comment="Standart ekspert matrisləri (ilkin versiya)",
            active=True,
        )
        session.add(method)
        await session.flush()
    return method


def method_weights(method: SuitabilityMethod) -> dict[str, model.Weights]:
    return {a: model.weights(method.matrices[a]) for a in model.ACTIVITIES}


def landcover(activity: str, purpose: Purpose, data_source: DataSource) -> tuple[float, str]:
    """How well what OSM maps on the plot fits the activity."""
    if data_source != DataSource.OSM:
        return 0.5, "Məlum deyil (OSM-də xəritələnməyib)"
    if purpose == activity:
        return 1.0, LANDCOVER_LABEL[purpose]
    if (activity, purpose) == (Purpose.LIVESTOCK, Purpose.ORCHARD):
        return 0.3, LANDCOVER_LABEL[purpose]
    return 0.6, LANDCOVER_LABEL[purpose]


def score_point(
    values: dict,
    tags: dict[str, str],
    weights: dict[str, model.Weights],
    demined: bool,
    irrigation_m: float | None,
    any_water_m: float | None,
    cover: dict[str, tuple[float, str]] | None = None,
) -> dict[str, dict]:
    """All activities for one place. `values` holds the agronomic factors plus road and
    settlement distances; water and land cover depend on the activity."""
    out = {}
    for activity in model.ACTIVITIES:
        v = dict(values)
        v["water"] = any_water_m if activity == "LIVESTOCK" else irrigation_m
        if cover:
            v["landcover_score"], v["landcover_text"] = cover[activity]
        out[activity] = model.assess(activity, v, tags, weights[activity], demined)
    return out


async def refresh(session: AsyncSession, area_ids: list[uuid.UUID]) -> int:
    """Measures the areas, scores them with the active method and replaces their results."""
    if not area_ids:
        return 0
    method = await active_method(session)
    weights = method_weights(method)
    measured = {row.id: row for row in (await session.execute(_DISTANCES, {"ids": area_ids})).all()}
    rows = (
        await session.execute(
            select(FarmArea, func.ST_X(FarmArea.centroid), func.ST_Y(FarmArea.centroid)).where(
                FarmArea.id.in_(area_ids)
            )
        )
    ).all()
    sampled = sources.sample([sources.Point(a.code, lon, lat) for a, lon, lat in rows])

    await session.execute(delete(AreaSuitability).where(AreaSuitability.farm_area_id.in_(area_ids)))
    for area, _lon, _lat in rows:
        d = measured.get(area.id)
        irrigation = d.irrigation_m if d else None
        road = d.road_m if d else None
        area.dist_water_m = round(irrigation) if irrigation is not None else None
        area.dist_road_m = round(road) if road is not None else None

        values = {f: v for f, (v, _tag) in sampled[area.code].items()}
        tags = {f: tag for f, (_v, tag) in sampled[area.code].items()}
        values["road"] = road
        values["settlement"] = area.dist_village_m
        tags.update(water="OSM", road="OSM", settlement="OSM", landcover="OSM")
        cover = {a: landcover(a, area.purpose, area.data_source) for a in model.ACTIVITIES}
        results = score_point(
            values,
            tags,
            weights,
            area.demining_status == DeminingStatus.CLEARED,
            irrigation,
            d.any_water_m if d else None,
            cover,
        )
        for activity, r in results.items():
            r["factors"]["_method"] = method.version
            session.add(
                AreaSuitability(
                    farm_area_id=area.id,
                    activity=Purpose(activity),
                    method_version=method.version,
                    score=r["score"],
                    fao_class=r["fao_class"],
                    constraint_reason=r["constraint_reason"],
                    factors=r["factors"],
                )
            )
    await session.flush()
    return len(rows)


async def refresh_missing(session: AsyncSession) -> int:
    """Scores every area that has no complete result for the active method yet."""
    method = await active_method(session)
    complete = (
        select(AreaSuitability.farm_area_id)
        .where(AreaSuitability.method_version == method.version)
        .group_by(AreaSuitability.farm_area_id)
        .having(func.count() == len(model.ACTIVITIES))
    )
    missing = (await session.scalars(select(FarmArea.id).where(FarmArea.id.not_in(complete)))).all()
    return await refresh(session, list(missing))


async def recompute_all(session: AsyncSession) -> int:
    ids = (await session.scalars(select(FarmArea.id))).all()
    return await refresh(session, list(ids))


async def activate(
    session: AsyncSession, matrices: dict, comment: str | None, user_id: uuid.UUID | None
) -> SuitabilityMethod:
    """Stores the matrices as the next method version, makes it active and re-scores all areas."""
    versions = (await session.scalars(select(SuitabilityMethod.version))).all()
    numbers = [int(v.rsplit(".", 1)[1]) for v in versions if v.startswith(DEFAULT_VERSION + ".")]
    version = f"{DEFAULT_VERSION}.{max(numbers, default=0) + 1}"
    await session.execute(update(SuitabilityMethod).values(active=False))
    method = SuitabilityMethod(
        version=version, matrices=matrices, comment=comment, active=True, created_by=user_id
    )
    session.add(method)
    await session.flush()
    await recompute_all(session)
    return method

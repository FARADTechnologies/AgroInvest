"""Suitability of a farm area for each activity: a transparent GIS multi-criteria analysis.

Decision support only; the competition commission decides. Method "mcda-1":

* Constraint: an area that is not cleared of mines is class N whatever its factors.
* Five factors, each turned into a 0–1 membership:
    water       distance to an irrigation source (river, canal, lake, reservoir); for
                livestock any water, streams included
    road        distance to a main road (access to markets)
    settlement  distance to the nearest settlement (labour, services)
    landcover   what OpenStreetMap maps on the plot (farmland, orchard/vineyard, meadow)
    terrain     relief class of the rayon (lowland, foothill, mountain): a coarse proxy
                until slope and elevation come from a DEM
  Distances use a linear fuzzy membership: 1 up to `good` metres, 0 from `poor` metres.
* Weights per activity come from an AHP pairwise comparison matrix (principal
  eigenvector) and are only used when its consistency ratio is below 0.1.
* Score = 100 × Σ weight × membership. FAO classes: S1 ≥ 75, S2 ≥ 50, S3 ≥ 25, else N.

Distances are measured in PostGIS against the roads and water loaded from OSM, so a
plot added by a specialist is scored the same way as the seeded ones.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import ARRAY, Uuid, bindparam, delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.areas.models import (
    AreaSuitability,
    DataSource,
    DeminingStatus,
    FaoClass,
    FarmArea,
    Purpose,
)
from app.modules.geo.models import Rayon

METHOD = "mcda-1"
ACTIVITIES = (Purpose.CROP, Purpose.ORCHARD, Purpose.LIVESTOCK)
CRITERIA = ("water", "road", "settlement", "landcover", "terrain")

# Saaty's random index for n criteria.
RANDOM_INDEX = {3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24}

# Upper triangles of the pairwise matrices, in CRITERIA order: how much more important the
# row criterion is than the column criterion (1 equal … 9 extremely more).
PAIRWISE: dict[Purpose, dict[tuple[str, str], float]] = {
    # Irrigated field crops: water first, then flat terrain and farmland, then roads.
    Purpose.CROP: {
        ("water", "road"): 3,
        ("water", "settlement"): 4,
        ("water", "landcover"): 2,
        ("water", "terrain"): 2,
        ("road", "settlement"): 2,
        ("road", "landcover"): 1 / 2,
        ("road", "terrain"): 1 / 2,
        ("settlement", "landcover"): 1 / 3,
        ("settlement", "terrain"): 1 / 3,
        ("landcover", "terrain"): 1,
    },
    # Orchards and vineyards: drip irrigation and foothill relief matter most; fruit needs roads.
    Purpose.ORCHARD: {
        ("water", "road"): 2,
        ("water", "settlement"): 3,
        ("water", "landcover"): 2,
        ("water", "terrain"): 1,
        ("road", "settlement"): 2,
        ("road", "landcover"): 1,
        ("road", "terrain"): 1 / 2,
        ("settlement", "landcover"): 1 / 2,
        ("settlement", "terrain"): 1 / 3,
        ("landcover", "terrain"): 1 / 2,
    },
    # Pasture livestock: grassland and relief first, water for the herd, roads matter least.
    Purpose.LIVESTOCK: {
        ("water", "road"): 3,
        ("water", "settlement"): 2,
        ("water", "landcover"): 1 / 2,
        ("water", "terrain"): 1,
        ("road", "settlement"): 1 / 2,
        ("road", "landcover"): 1 / 4,
        ("road", "terrain"): 1 / 3,
        ("settlement", "landcover"): 1 / 3,
        ("settlement", "terrain"): 1 / 2,
        ("landcover", "terrain"): 2,
    },
}

# (good, poor) metres for the linear membership of each distance factor.
DISTANCE_RULES: dict[Purpose, dict[str, tuple[int, int]]] = {
    Purpose.CROP: {"water": (300, 3000), "road": (500, 8000), "settlement": (1000, 10000)},
    Purpose.ORCHARD: {"water": (300, 3000), "road": (500, 6000), "settlement": (1000, 10000)},
    Purpose.LIVESTOCK: {"water": (500, 4000), "road": (1000, 15000), "settlement": (1000, 12000)},
}

# Relief class per rayon (ISO 3166-2). Coarse on purpose; replaced by DEM slope later.
TERRAIN = {
    "AZ-AGC": "lowland",
    "AZ-BAR": "lowland",
    "AZ-AGM": "lowland",
    "AZ-TAR": "lowland",
    "AZ-FUZ": "lowland",
    "AZ-CAB": "lowland",
    "AZ-ZAN": "lowland",
    "AZ-XCI": "foothill",
    "AZ-XVD": "foothill",
    "AZ-QBI": "foothill",
    "AZ-XA": "foothill",
    "AZ-SUS": "mountain",
    "AZ-LAC": "mountain",
    "AZ-KAL": "mountain",
}
TERRAIN_LABEL = {"lowland": "Düzənlik", "foothill": "Dağətəyi", "mountain": "Dağlıq"}
TERRAIN_MEMBERSHIP = {
    Purpose.CROP: {"lowland": 1.0, "foothill": 0.6, "mountain": 0.2},
    Purpose.ORCHARD: {"lowland": 0.8, "foothill": 1.0, "mountain": 0.4},
    Purpose.LIVESTOCK: {"lowland": 0.5, "foothill": 0.8, "mountain": 1.0},
}

LANDCOVER_LABEL = {
    Purpose.CROP: "Əkin sahəsi (OSM)",
    Purpose.ORCHARD: "Bağ və ya üzümlük (OSM)",
    Purpose.LIVESTOCK: "Çəmənlik (OSM)",
}


def ahp_weights(activity: Purpose) -> tuple[dict[str, float], float]:
    """Principal-eigenvector weights and the consistency ratio of an activity's matrix."""
    n = len(CRITERIA)
    m = [[1.0] * n for _ in range(n)]
    for (a, b), v in PAIRWISE[activity].items():
        i, j = CRITERIA.index(a), CRITERIA.index(b)
        m[i][j], m[j][i] = v, 1 / v
    w = [1 / n] * n
    for _ in range(100):  # power iteration
        nxt = [sum(m[i][j] * w[j] for j in range(n)) for i in range(n)]
        total = sum(nxt)
        w = [x / total for x in nxt]
    lambda_max = sum(sum(m[i][j] * w[j] for j in range(n)) / w[i] for i in range(n)) / n
    ci = (lambda_max - n) / (n - 1)
    return dict(zip(CRITERIA, w, strict=True)), ci / RANDOM_INDEX[n]


WEIGHTS = {a: ahp_weights(a) for a in ACTIVITIES}


def linear(distance: float | None, good: int, poor: int) -> float:
    if distance is None:
        return 0.0  # nothing within reach in the reference data
    if distance <= good:
        return 1.0
    if distance >= poor:
        return 0.0
    return round(1 - (distance - good) / (poor - good), 3)


def fao_class(score: int) -> FaoClass:
    if score >= 75:
        return FaoClass.S1
    if score >= 50:
        return FaoClass.S2
    if score >= 25:
        return FaoClass.S3
    return FaoClass.N


@dataclass
class Inputs:
    irrigation_m: float | None
    any_water_m: float | None
    road_m: float | None
    settlement_m: float | None
    purpose: Purpose
    data_source: DataSource
    rayon_iso: str
    demining: DeminingStatus


def _km(metres: float | None) -> float | None:
    return None if metres is None else round(metres / 1000, 1)


def assess(activity: Purpose, x: Inputs) -> tuple[int, FaoClass, str | None, dict]:
    """Score, FAO class, constraint reason and the factor breakdown for one activity."""
    weights, cr = WEIGHTS[activity]
    rules = DISTANCE_RULES[activity]
    water_m = x.any_water_m if activity == Purpose.LIVESTOCK else x.irrigation_m
    terrain = TERRAIN.get(x.rayon_iso, "lowland")

    if x.data_source == DataSource.OSM:
        if x.purpose == activity:
            cover, cover_text = 1.0, LANDCOVER_LABEL[activity]
        else:
            cover = 0.3 if (activity, x.purpose) == (Purpose.LIVESTOCK, Purpose.ORCHARD) else 0.6
            cover_text = LANDCOVER_LABEL.get(x.purpose, "Kənd təsərrüfatı sahəsi (OSM)")
    else:
        cover, cover_text = 0.5, "Məlum deyil (OSM-də xəritələnməyib)"

    factors = {
        "water": {
            "label": "Su mənbəyinə məsafə"
            if activity == Purpose.LIVESTOCK
            else "Suvarma mənbəyinə məsafə",
            "value": _km(water_m),
            "unit": "km",
            "membership": linear(water_m, *rules["water"]),
        },
        "road": {
            "label": "Əsas yola məsafə",
            "value": _km(x.road_m),
            "unit": "km",
            "membership": linear(x.road_m, *rules["road"]),
        },
        "settlement": {
            "label": "Yaşayış məntəqəsinə məsafə",
            "value": _km(x.settlement_m),
            "unit": "km",
            "membership": linear(x.settlement_m, *rules["settlement"]),
        },
        "landcover": {
            "label": "Torpaq örtüyü",
            "value": None,
            "text": cover_text,
            "membership": cover,
        },
        "terrain": {
            "label": "Relyef (rayon üzrə təxmini)",
            "value": None,
            "text": TERRAIN_LABEL[terrain],
            "membership": TERRAIN_MEMBERSHIP[activity][terrain],
        },
    }
    for key, f in factors.items():
        f["weight"] = round(weights[key], 3)
    score = round(100 * sum(weights[k] * f["membership"] for k, f in factors.items()))
    factors["_cr"] = round(cr, 3)
    factors["_method"] = METHOD

    if x.demining != DeminingStatus.CLEARED:
        return score, FaoClass.N, "Minatəmizləmə başa çatmayıb (nümayiş statusu)", factors
    return score, fao_class(score), None, factors


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


async def refresh(session: AsyncSession, area_ids: list[uuid.UUID]) -> int:
    """Measures the areas, stores their distances and replaces their suitability rows."""
    if not area_ids:
        return 0
    measured = {row.id: row for row in (await session.execute(_DISTANCES, {"ids": area_ids})).all()}
    rows = (
        await session.execute(
            select(FarmArea, Rayon.iso_code)
            .join(Rayon, Rayon.id == FarmArea.rayon_id)
            .where(FarmArea.id.in_(area_ids))
        )
    ).all()
    await session.execute(delete(AreaSuitability).where(AreaSuitability.farm_area_id.in_(area_ids)))
    for area, rayon_iso in rows:
        d = measured.get(area.id)
        irrigation = d.irrigation_m if d else None
        road = d.road_m if d else None
        area.dist_water_m = round(irrigation) if irrigation is not None else None
        area.dist_road_m = round(road) if road is not None else None
        x = Inputs(
            irrigation_m=irrigation,
            any_water_m=d.any_water_m if d else None,
            road_m=road,
            settlement_m=area.dist_village_m,
            purpose=area.purpose,
            data_source=area.data_source,
            rayon_iso=rayon_iso,
            demining=area.demining_status,
        )
        for activity in ACTIVITIES:
            score, cls, reason, factors = assess(activity, x)
            session.add(
                AreaSuitability(
                    farm_area_id=area.id,
                    activity=activity,
                    method_version=METHOD,
                    score=score,
                    fao_class=cls,
                    constraint_reason=reason,
                    factors=factors,
                )
            )
    await session.flush()
    return len(rows)


async def refresh_missing(session: AsyncSession) -> int:
    """Scores every area that has no result for the current method yet."""
    scored = select(AreaSuitability.farm_area_id).where(AreaSuitability.method_version == METHOD)
    missing = (await session.scalars(select(FarmArea.id).where(FarmArea.id.not_in(scored)))).all()
    return await refresh(session, list(missing))

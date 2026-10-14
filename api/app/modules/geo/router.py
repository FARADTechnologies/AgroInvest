import json

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import SessionDep
from app.modules.geo.models import CountryOutline, Rayon, Region

router = APIRouter(prefix="/reference", tags=["reference data"])


class RegionOut(BaseModel):
    code: str
    name_az: str
    name_en: str


class RayonOut(BaseModel):
    id: int
    iso_code: str
    name_az: str
    name_en: str
    region_code: str


@router.get("/regions", response_model=list[RegionOut])
async def regions(session: SessionDep) -> list[RegionOut]:
    rows = (await session.scalars(select(Region).order_by(Region.id))).all()
    return [RegionOut(code=r.code, name_az=r.name_az, name_en=r.name_en) for r in rows]


@router.get("/rayons", response_model=list[RayonOut])
async def rayons(session: SessionDep) -> list[RayonOut]:
    rows = (await session.scalars(select(Rayon).order_by(Rayon.name_az))).all()
    return [
        RayonOut(
            id=r.id, iso_code=r.iso_code, name_az=r.name_az, name_en=r.name_en, region_code=r.region.code
        )
        for r in rows
    ]


@router.get("/map-context", summary="Rayon boundaries, label points and the outside-country mask")
async def map_context(session: SessionDep) -> dict:
    """Context layers for the map. Labels come only from curated Azerbaijani names."""
    rayon_rows = (
        await session.execute(
            select(
                Rayon.id,
                Rayon.name_az,
                func.ST_AsGeoJSON(func.ST_SimplifyPreserveTopology(Rayon.geom, 0.0005), 5),
                func.ST_AsGeoJSON(func.ST_PointOnSurface(Rayon.geom), 5),
            ).where(Rayon.geom.is_not(None))
        )
    ).all()
    boundaries = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "id": rid, "properties": {"name": name}, "geometry": json.loads(geom)}
            for rid, name, geom, _ in rayon_rows
        ],
    }
    labels = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"name": name}, "geometry": json.loads(point)}
            for _, name, _, point in rayon_rows
        ],
    }
    bounds = (
        await session.execute(
            select(
                func.ST_XMin(func.ST_Extent(Rayon.geom)),
                func.ST_YMin(func.ST_Extent(Rayon.geom)),
                func.ST_XMax(func.ST_Extent(Rayon.geom)),
                func.ST_YMax(func.ST_Extent(Rayon.geom)),
            )
        )
    ).one()

    # Everything outside Azerbaijan is greyed out and carries no labels.
    mask_geojson = await session.scalar(
        select(
            func.ST_AsGeoJSON(
                func.ST_Difference(
                    func.ST_MakeEnvelope(30, 30, 60, 50, 4326),
                    func.ST_SimplifyPreserveTopology(CountryOutline.geom, 0.001),
                ),
                5,
            )
        ).limit(1)
    )
    mask = (
        {"type": "Feature", "properties": {}, "geometry": json.loads(mask_geojson)}
        if mask_geojson
        else None
    )
    return {
        "bounds": list(bounds) if bounds[0] is not None else None,
        "rayons": boundaries,
        "rayon_labels": labels,
        "mask": mask,
    }

"""Vector tiles of the reference roads and water, straight from PostGIS.

They give the map its context when the online basemap is unreachable (venue Wi-Fi,
an isolated network): together with the country outline, sea, rayons and farm areas,
the map stays fully readable without any external service. No names are included.
"""

from fastapi import APIRouter, Path, Response
from sqlalchemy import text

from app.core.deps import SessionDep

router = APIRouter(prefix="/tiles", tags=["reference data"])

_TILE = text(
    """
    WITH bounds AS (SELECT ST_TileEnvelope(:z, :x, :y) AS geom),
    features AS (
      SELECT ST_AsMVTGeom(ST_Transform(f.geom, 3857), bounds.geom, 4096, 64, true) AS geom,
             f.kind, f.subtype
      FROM geo_feature f, bounds
      WHERE f.geom && ST_Transform(bounds.geom, 4326)
        AND (:z >= 9 OR f.subtype IN ('trunk', 'primary', 'river', 'reservoir', 'lake'))
    )
    SELECT ST_AsMVT(features.*, 'context', 4096, 'geom') FROM features WHERE geom IS NOT NULL
    """
)


@router.get(
    "/context/{z}/{x}/{y}.pbf",
    summary="Roads and water as Mapbox vector tiles (offline map context)",
    response_class=Response,
)
async def context_tile(
    session: SessionDep,
    z: int = Path(ge=0, le=16),
    x: int = Path(ge=0),
    y: int = Path(ge=0),
) -> Response:
    tile = await session.scalar(_TILE, {"z": z, "x": x, "y": y})
    return Response(
        content=bytes(tile or b""),
        media_type="application/vnd.mapbox-vector-tile",
        headers={"Cache-Control": "public, max-age=86400"},
    )

"""Reference data: regions, rayons, settlements, country outline, document types."""

import csv
import json
from pathlib import Path

from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon, shape
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.competitions.models import DocumentType
from app.modules.geo.models import CountryOutline, Rayon, Region, Village


def read_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def read_geojson(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["features"]


def as_multi(geom):
    return geom if geom.geom_type == "MultiPolygon" else MultiPolygon([geom])


async def load_reference(session: AsyncSession, seed_dir: Path) -> dict[str, Rayon]:
    regions = {}
    for i, row in enumerate(read_csv(seed_dir / "reference" / "regions.csv"), start=1):
        region = Region(id=i, code=row["code"], name_az=row["name_az"], name_en=row["name_en"])
        session.add(region)
        regions[row["code"]] = region
    await session.flush()

    geoms = {
        f["properties"]["iso_code"]: shape(f["geometry"])
        for f in read_geojson(seed_dir / "geo" / "rayons.geojson")
    }
    rayons: dict[str, Rayon] = {}
    for i, row in enumerate(read_csv(seed_dir / "reference" / "rayons.csv"), start=1):
        geom = geoms.get(row["iso_code"])
        rayon = Rayon(
            id=i,
            region_id=regions[row["region_code"]].id,
            iso_code=row["iso_code"],
            short_code=row["short_code"],
            name_az=row["name_az"],
            name_en=row["name_en"],
            label_az=row["label_az"],
            geom=from_shape(as_multi(geom), srid=4326) if geom is not None else None,
        )
        session.add(rayon)
        rayons[row["iso_code"]] = rayon
    await session.flush()  # rayons must exist before settlements reference them

    for f in read_geojson(seed_dir / "geo" / "country.geojson"):
        session.add(CountryOutline(geom=from_shape(as_multi(shape(f["geometry"])), srid=4326)))

    for f in read_geojson(seed_dir / "geo" / "villages.geojson"):
        p = f["properties"]
        rayon = rayons.get(p["iso_code"])
        if rayon is None:
            continue
        session.add(
            Village(
                rayon_id=rayon.id,
                name_az=p["name_az"],
                geom=from_shape(shape(f["geometry"]), srid=4326),
                osm_id=int(p["osm_id"]) if p.get("osm_id") else None,
            )
        )

    for row in read_csv(seed_dir / "reference" / "document_types.csv"):
        session.add(
            DocumentType(
                code=row["code"],
                name_az=row["name_az"],
                description_az=row["description_az"],
                applies_to=row["applies_to"],
                max_mb=int(row["max_mb"]),
            )
        )
    await session.flush()
    return rayons

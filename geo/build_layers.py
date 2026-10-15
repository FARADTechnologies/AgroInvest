"""Extracts the reference layers the suitability analysis measures distances to.

Outputs (seed/geo/):
  roads.geojson   main roads (motorway … tertiary and their links)
  water.geojson   rivers, canals, streams and water bodies (lakes, reservoirs)

Only geometry and the OSM type are kept: no names, so the place-name policy holds.
The API loads both into PostGIS and measures every farm area against them, which
also works for plots a specialist adds later.

Usage:
    python geo/build_layers.py [path/to/azerbaijan-latest.osm.pbf]
"""

from __future__ import annotations

import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely

sys.path.insert(0, str(Path(__file__).parent))
from pipeline.osm import read_layer, tag  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "seed" / "geo"
UTM = 32638
SIMPLIFY_DEG = 0.0002  # about 20 m, well below the distances that matter here
MARGIN_DEG = 0.15  # take features just outside the rayons too: the nearest road may be there

MAIN_ROADS = (
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
)
WATERWAYS = ("river", "canal", "stream")


def study_bbox() -> tuple[float, float, float, float]:
    rayons = gpd.read_file(OUT / "rayons.geojson")
    minx, miny, maxx, maxy = rayons.total_bounds
    return (minx - MARGIN_DEG, miny - MARGIN_DEG, maxx + MARGIN_DEG, maxy + MARGIN_DEG)


def roads(pbf: Path, bbox) -> gpd.GeoDataFrame:
    quoted = ", ".join(f"'{h}'" for h in MAIN_ROADS)
    frame = read_layer(pbf, "lines", where=f"highway IN ({quoted})", bbox=bbox)
    return gpd.GeoDataFrame(
        {"kind": "ROAD", "subtype": frame["highway"].str.replace("_link", "", regex=False)},
        geometry=frame.geometry,
        crs=4326,
    )


def water(pbf: Path, bbox) -> gpd.GeoDataFrame:
    quoted = ", ".join(f"'{w}'" for w in WATERWAYS)
    lines = read_layer(pbf, "lines", where=f"waterway IN ({quoted})", bbox=bbox)
    lines = gpd.GeoDataFrame({"kind": "WATER", "subtype": lines["waterway"]}, geometry=lines.geometry, crs=4326)

    polys = read_layer(pbf, "multipolygons", where="natural = 'water' OR landuse = 'reservoir'", bbox=bbox)
    polys["water"] = tag(polys, "water").fillna("lake")
    polys = polys[polys.to_crs(UTM).area >= 10_000]  # ignore ponds under one hectare
    polys = gpd.GeoDataFrame(
        {"kind": "WATER", "subtype": polys["water"].map(lambda w: "reservoir" if w == "reservoir" else "lake")},
        geometry=shapely.make_valid(polys.geometry.values),
        crs=4326,
    )
    return pd.concat([lines, polys], ignore_index=True)


def write(frame: gpd.GeoDataFrame, name: str) -> None:
    frame = frame[~frame.geometry.is_empty & frame.geometry.notna()].copy()
    frame["geometry"] = frame.geometry.simplify(SIMPLIFY_DEG)
    frame = frame[~frame.geometry.is_empty]
    frame.to_file(OUT / name, driver="GeoJSON", COORDINATE_PRECISION=5)
    print(f"{name}: {len(frame)} features, {frame['subtype'].value_counts().to_dict()}")


def main(pbf: Path) -> None:
    bbox = study_bbox()
    write(roads(pbf, bbox), "roads.geojson")
    write(water(pbf, bbox), "water.geojson")


if __name__ == "__main__":
    default = ROOT / "geo" / "cache" / "azerbaijan-latest.osm.pbf"
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else default)

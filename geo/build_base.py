"""Builds the base geography seed from the Geofabrik Azerbaijan extract.

Outputs (seed/geo/):
  country.geojson     Azerbaijan outline, used to mask the map outside the country
  rayons.geojson      the 14 rayons in scope, with curated Azerbaijani names
  villages.geojson    settlements that carry an Azerbaijani name (name:az) in OSM
  farm_areas.geojson  candidate farm areas: OSM farmland/orchard/meadow polygons
                      where coverage is good, synthetic polygons near real villages
                      where it is thin (marked data_source=SYNTHETIC)

Place-name policy: the OSM `name` tag is never used, only `name:az` and our
curated rayon table, so no foreign or occupation-era toponym can reach the map.

Usage:
    python geo/build_base.py [path/to/azerbaijan-latest.osm.pbf]
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from shapely.affinity import rotate
from shapely.geometry import MultiPolygon, Polygon

sys.path.insert(0, str(Path(__file__).parent))
from pipeline.osm import read_layer, tag  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "seed"
OUT = SEED / "geo"
UTM = 32638  # WGS 84 / UTM zone 38N: metre-based maths for the region

LANDUSE_PURPOSE = {"farmland": "CROP", "orchard": "ORCHARD", "vineyard": "ORCHARD", "meadow": "LIVESTOCK"}
MIN_HA, MAX_HA = 5.0, 300.0

# How many areas to take per rayon, and what to synthesise where OSM is thin.
# Mountain rayons are known for summer pastures, hence livestock.
PLAN = {
    "AZ-AGM": {"osm": 7},
    "AZ-FUZ": {"osm": 6},
    "AZ-ZAN": {"osm": 6, "synthetic": {"OTHER": 1}},
    "AZ-XCI": {"osm": 6},
    "AZ-XVD": {"osm": 6},
    "AZ-AGC": {"osm": 3},
    "AZ-BAR": {"osm": 3},
    "AZ-TAR": {"osm": 3},
    "AZ-QBI": {"osm": 3, "synthetic": {"ORCHARD": 1}},
    "AZ-CAB": {"osm": 2, "synthetic": {"CROP": 2, "ORCHARD": 1}},
    "AZ-XA": {"osm": 1, "synthetic": {"OTHER": 1}},
    "AZ-LAC": {"osm": 1, "synthetic": {"LIVESTOCK": 3}},
    "AZ-SUS": {"osm": 1, "synthetic": {"LIVESTOCK": 1, "ORCHARD": 1}},
    "AZ-KAL": {"osm": 0, "synthetic": {"LIVESTOCK": 4}},
}


def load_rayon_table() -> pd.DataFrame:
    return pd.read_csv(SEED / "reference" / "rayons.csv")


def extract_boundaries(pbf: Path, table: pd.DataFrame) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
    # Rayon admin levels differ between OSM snapshots (5 or 6), so match on ISO 3166-2 codes.
    admin = read_layer(pbf, "multipolygons", where="boundary = 'administrative' AND admin_level IN ('4', '5', '6')")
    admin["iso2"] = tag(admin, "ISO3166-2").fillna("")
    admin = admin[admin["iso2"].str.startswith("AZ-")]

    # The country relation is not assembled in the extract; the union of all first-level
    # units is the country. Interior gaps are filled: the outline is only used as a mask.
    union = shapely.union_all(shapely.make_valid(admin.geometry.values))
    parts = [Polygon(p.exterior) for p in getattr(union, "geoms", [union]) if p.geom_type == "Polygon"]
    country = gpd.GeoDataFrame(geometry=[MultiPolygon(parts)], crs=4326)

    rayons = admin[admin["iso2"].isin(table["iso_code"])][["iso2", "geometry"]].rename(columns={"iso2": "iso_code"})
    rayons = rayons.dissolve(by="iso_code", as_index=False)
    missing = set(table["iso_code"]) - set(rayons["iso_code"])
    if missing:
        raise SystemExit(f"Rayon boundaries missing in the extract: {sorted(missing)}")
    rayons = rayons.merge(table, on="iso_code")
    rayons["geometry"] = shapely.make_valid(rayons.geometry.values)
    return country, rayons


def extract_villages(pbf: Path, rayons: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    bbox = tuple(rayons.total_bounds)
    points = read_layer(pbf, "points", where="place IN ('city', 'town', 'village', 'hamlet')", bbox=bbox)
    points["name_az"] = tag(points, "name:az")
    points = points[points["name_az"].notna() & (points["name_az"].str.strip() != "")]
    joined = gpd.sjoin(points[["osm_id", "name_az", "place", "geometry"]], rayons[["iso_code", "geometry"]], predicate="within")
    return joined.drop(columns="index_right").reset_index(drop=True)


def extract_landuse(pbf: Path, rayons: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    bbox = tuple(rayons.total_bounds)
    polys = read_layer(
        pbf, "multipolygons", where="landuse IN ('farmland', 'orchard', 'vineyard', 'meadow')", bbox=bbox
    )
    polys = polys[["osm_id", "osm_way_id", "landuse", "geometry"]].copy()
    polys["geometry"] = shapely.make_valid(polys.geometry.values)
    polys = polys[polys.geometry.geom_type.isin(["Polygon", "MultiPolygon"])]
    metric = polys.to_crs(UTM)
    polys["area_ha"] = metric.area / 10_000
    polys = polys[(polys["area_ha"] >= MIN_HA) & (polys["area_ha"] <= MAX_HA)]
    centroids = polys.copy()
    centroids["geometry"] = polys.to_crs(UTM).centroid.to_crs(4326)
    within = gpd.sjoin(centroids, rayons[["iso_code", "geometry"]], predicate="within")
    polys = polys.loc[within.index].assign(iso_code=within["iso_code"].values)
    polys["purpose"] = polys["landuse"].map(LANDUSE_PURPOSE)
    polys["osm_ref"] = polys["osm_way_id"].fillna(polys["osm_id"]).astype(str)
    return polys


def pick_osm(candidates: gpd.GeoDataFrame, count: int, rng: np.random.Generator) -> gpd.GeoDataFrame:
    """Takes a varied sample: every purpose present first, then a spread of sizes."""
    if count <= 0 or candidates.empty:
        return candidates.iloc[0:0]
    chosen: list[int] = []
    for purpose in ("ORCHARD", "LIVESTOCK", "CROP"):
        pool = candidates[(candidates["purpose"] == purpose) & ~candidates.index.isin(chosen)]
        if not pool.empty and len(chosen) < count:
            chosen.append(pool.sample(1, random_state=int(rng.integers(1e9))).index[0])
    rest = candidates[~candidates.index.isin(chosen)].sort_values("area_ha")
    if len(rest) and len(chosen) < count:
        idx = np.linspace(0, len(rest) - 1, num=min(count - len(chosen), len(rest))).round().astype(int)
        chosen.extend(rest.index[np.unique(idx)])
    return candidates.loc[chosen]


def synthetic_polygon(center_xy: tuple[float, float], area_ha: float, rng: np.random.Generator) -> Polygon:
    """An irregular field-like quadrilateral of roughly the requested area (UTM metres)."""
    aspect = rng.uniform(1.3, 2.6)
    width = math.sqrt(area_ha * 10_000 / aspect)
    height = width * aspect
    cx, cy = center_xy
    jitter = lambda: rng.uniform(-0.08, 0.08) * width  # noqa: E731
    corners = [
        (cx - width / 2 + jitter(), cy - height / 2 + jitter()),
        (cx + width / 2 + jitter(), cy - height / 2 + jitter()),
        (cx + width / 2 + jitter(), cy + height / 2 + jitter()),
        (cx - width / 2 + jitter(), cy + height / 2 + jitter()),
    ]
    return rotate(Polygon(corners), rng.uniform(0, 180), origin="centroid")


def make_synthetic(
    rayon: pd.Series,
    purposes: dict[str, int],
    villages: gpd.GeoDataFrame,
    taken: list,
    rng: np.random.Generator,
) -> list[dict]:
    rayon_utm = gpd.GeoSeries([rayon.geometry], crs=4326).to_crs(UTM).iloc[0]
    local = villages[villages["iso_code"] == rayon.iso_code].to_crs(UTM)
    anchors = list(local.geometry) or [rayon_utm.representative_point()]
    sizes = {"CROP": (20, 90), "ORCHARD": (8, 40), "LIVESTOCK": (40, 160), "OTHER": (3, 12)}
    out = []
    for purpose, n in purposes.items():
        for _ in range(n):
            for _attempt in range(80):
                anchor = anchors[int(rng.integers(len(anchors)))]
                angle = rng.uniform(0, 2 * math.pi)
                dist = rng.uniform(600, 2500)
                center = (anchor.x + dist * math.cos(angle), anchor.y + dist * math.sin(angle))
                poly = synthetic_polygon(center, rng.uniform(*sizes[purpose]), rng)
                if not rayon_utm.contains(poly):
                    continue
                if any(poly.buffer(150).intersects(t) for t in taken):
                    continue
                taken.append(poly)
                out.append({"purpose": purpose, "iso_code": rayon.iso_code, "geometry_utm": poly})
                break
    return out


def nearest_village(areas_utm: gpd.GeoDataFrame, villages: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    vill = villages.to_crs(UTM)[["name_az", "osm_id", "geometry"]].rename(
        columns={"name_az": "village_name", "osm_id": "village_osm_id"}
    )
    cent = areas_utm.copy()
    cent["geometry"] = areas_utm.centroid
    joined = gpd.sjoin_nearest(cent, vill, how="left", distance_col="dist_village_m", max_distance=8000)
    joined = joined[~joined.index.duplicated(keep="first")]
    areas_utm["village_name"] = joined["village_name"]
    areas_utm["village_osm_id"] = joined["village_osm_id"]
    areas_utm["dist_village_m"] = joined["dist_village_m"].round()
    return areas_utm


def main(pbf: Path) -> None:
    rng = np.random.default_rng(2026)
    table = load_rayon_table()
    print("reading boundaries…")
    country, rayons = extract_boundaries(pbf, table)
    print("reading villages…")
    villages = extract_villages(pbf, rayons)
    print(f"  {len(villages)} villages with name:az")
    print("reading landuse…")
    landuse = extract_landuse(pbf, rayons)
    print(f"  {len(landuse)} landuse polygons of {MIN_HA}-{MAX_HA} ha in scope")

    rows: list[dict] = []
    taken: list = []
    for _, rayon in rayons.sort_values("iso_code").iterrows():
        plan = PLAN.get(rayon.iso_code, {"osm": 2})
        picked = pick_osm(landuse[landuse["iso_code"] == rayon.iso_code], plan.get("osm", 0), rng)
        for _, p in picked.to_crs(UTM).iterrows():
            geom = p.geometry
            if any(geom.intersects(t) for t in taken):
                continue
            taken.append(geom)
            rows.append(
                {"purpose": p.purpose, "iso_code": rayon.iso_code, "geometry_utm": geom,
                 "data_source": "OSM", "osm_ref": p.osm_ref}
            )
        for s in make_synthetic(rayon, plan.get("synthetic", {}), villages, taken, rng):
            rows.append({**s, "data_source": "SYNTHETIC", "osm_ref": None})

    areas = gpd.GeoDataFrame(rows, geometry="geometry_utm", crs=UTM).rename_geometry("geometry")
    areas["area_ha"] = (areas.area / 10_000).round(2)
    areas = nearest_village(areas, villages)
    areas = areas.to_crs(4326)
    areas["geometry"] = [g if isinstance(g, MultiPolygon) else MultiPolygon([g]) for g in areas.geometry]

    short = dict(zip(table["iso_code"], table["short_code"], strict=True))
    areas = areas.sort_values(["iso_code", "area_ha"], ascending=[True, False]).reset_index(drop=True)
    areas["code"] = [
        f"{short[iso]}-{n:04d}" for iso, n in zip(areas["iso_code"], areas.groupby("iso_code").cumcount() + 1, strict=True)
    ]

    OUT.mkdir(parents=True, exist_ok=True)
    country.assign(geometry=country.simplify(0.002)).to_file(OUT / "country.geojson", driver="GeoJSON", COORDINATE_PRECISION=5)
    rayons[["iso_code", "geometry"]].assign(geometry=rayons.simplify(0.0004)).to_file(
        OUT / "rayons.geojson", driver="GeoJSON", COORDINATE_PRECISION=5
    )
    villages[["osm_id", "name_az", "place", "iso_code", "geometry"]].to_file(
        OUT / "villages.geojson", driver="GeoJSON", COORDINATE_PRECISION=6
    )
    areas[
        ["code", "iso_code", "purpose", "area_ha", "data_source", "osm_ref", "village_name", "village_osm_id",
         "dist_village_m", "geometry"]
    ].to_file(OUT / "farm_areas.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)

    summary = areas.groupby(["iso_code", "data_source"]).size().unstack(fill_value=0)
    print(summary.to_string())
    print(f"total areas: {len(areas)}; by purpose: {areas['purpose'].value_counts().to_dict()}")


if __name__ == "__main__":
    default = ROOT / "geo" / "cache" / "azerbaijan-latest.osm.pbf"
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else default)

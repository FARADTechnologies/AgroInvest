"""Reads features from the Geofabrik OSM extract with GDAL's OSM driver.

OSM data © OpenStreetMap contributors, licensed under ODbL.
"""

from __future__ import annotations

import re
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio

_TAG = re.compile(r'"((?:[^"\\]|\\.)+)"=>"((?:[^"\\]|\\.)*)"')


def parse_other_tags(raw: str | None) -> dict[str, str]:
    """Parses GDAL's hstore-like `other_tags` column into a dict."""
    if not raw:
        return {}
    return {k.replace('\\"', '"'): v.replace('\\"', '"') for k, v in _TAG.findall(raw)}


def read_layer(
    pbf: Path,
    layer: str,
    where: str | None = None,
    bbox: tuple[float, float, float, float] | None = None,
) -> gpd.GeoDataFrame:
    frame = pyogrio.read_dataframe(pbf, layer=layer, where=where, bbox=bbox)
    if "other_tags" in frame.columns:
        frame["tags"] = frame["other_tags"].map(parse_other_tags)
    else:
        frame["tags"] = [{} for _ in range(len(frame))]
    return frame.set_crs(4326, allow_override=True)


def tag(frame: pd.DataFrame, key: str) -> pd.Series:
    return frame["tags"].map(lambda t: t.get(key))

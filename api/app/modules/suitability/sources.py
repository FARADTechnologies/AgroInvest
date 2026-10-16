"""Where factor values come from: one adapter per factor, chosen by configuration.

Today every soil, climate and terrain factor comes from `SyntheticSource`: demo values that
follow the region's real geography (Kür-Araz lowland dry, warm, sunny and saline; Kəlbəcər,
Laçın and Şuşa wet, cool, frosty and steep). They are deterministic — the same place always
gets the same values — and every value is stored with its source tag.

To use real data, sample a raster (SoilGrids, WorldClim, Copernicus DEM, …) or an EKTIS export
into a CSV and point the factor at it in `SUITABILITY_SOURCES`, for example
`{"ph": {"adapter": "csv", "path": "/seed/factors/ph.csv", "column": "ph"}}`. No code changes.
"""

import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.core.config import get_settings

AGRONOMIC = (
    "fertility",
    "soc",
    "nitrogen",
    "ph",
    "texture",
    "salinity",
    "precip",
    "temp",
    "frost_free",
    "ghi",
    "elevation",
    "slope",
    "aspect",
    "potable",
)


@dataclass(frozen=True)
class Point:
    id: str  # area code or H3 index
    lon: float
    lat: float


class FactorSource(Protocol):
    tag: str

    def sample(self, points: list[Point], factors: set[str]) -> dict[str, dict[str, object]]: ...


# ── Synthetic, geography-shaped demo values ─────────────────────────────────

# Typical elevations (m) at known places; interpolated between them. Approximate, for demo only.
ANCHORS: tuple[tuple[float, float, float], ...] = (
    (47.80, 40.10, 10),
    (47.46, 40.05, 40),
    (47.13, 40.37, 90),
    (47.60, 40.40, 25),
    (46.93, 40.34, 230),
    (46.99, 39.99, 400),
    (47.15, 39.60, 350),
    (47.33, 39.45, 200),
    (47.20, 39.38, 150),
    (46.79, 39.91, 750),
    (46.75, 39.82, 850),
    (46.75, 39.76, 1400),
    (46.95, 39.52, 900),
    (47.10, 39.70, 600),
    (46.55, 39.64, 1300),
    (46.35, 39.70, 1900),
    (46.04, 40.10, 1600),
    (46.10, 40.30, 2300),
    (45.80, 40.00, 2600),
    (46.25, 40.20, 2200),
    (46.58, 39.34, 700),
    (46.40, 39.35, 1300),
    (46.65, 39.09, 500),
    (46.80, 39.05, 300),
    (46.40, 39.15, 1500),
    (47.03, 39.40, 500),
    (47.05, 39.22, 280),
    (46.95, 39.50, 1100),
    (46.60, 40.20, 1000),
    (46.55, 40.15, 900),
    # Kür-Araz lowland and the plain below Ağdam, Tərtər and Füzuli.
    (47.20, 40.14, 70),
    (47.12, 40.04, 130),
    (47.05, 40.03, 180),
    (47.04, 40.43, 100),
    (47.18, 40.39, 60),
    (47.07, 40.22, 150),
    (47.53, 39.60, 140),
    (47.62, 39.59, 110),
    (47.31, 39.41, 210),
    (47.40, 39.75, 110),
    (47.70, 39.90, 40),
    (47.25, 39.90, 150),
    (46.95, 39.92, 360),
    (46.86, 39.99, 450),
)


def _hash01(ix: int, iy: int, seed: int) -> float:
    h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 2**32


def _noise(lon: float, lat: float, scale: float, seed: int) -> float:
    """Smooth value noise in [-1, 1]: neighbouring places get similar values."""
    x, y = lon / scale, lat / scale
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _hash01(ix, iy, seed), _hash01(ix + 1, iy, seed)
    c, d = _hash01(ix, iy + 1, seed), _hash01(ix + 1, iy + 1, seed)
    top, bottom = a + (b - a) * sx, c + (d - c) * sx
    return 2 * (top + (bottom - top) * sy) - 1


def _fbm(lon: float, lat: float, seed: int) -> float:
    return (
        0.6 * _noise(lon, lat, 0.25, seed)
        + 0.3 * _noise(lon, lat, 0.08, seed + 1)
        + 0.1 * _noise(lon, lat, 0.025, seed + 2)
    )


def _elevation(lon: float, lat: float) -> float:
    num = den = 0.0
    for alon, alat, elev in ANCHORS:
        dx = (lon - alon) * 85.0  # km per degree of longitude at ~40° N
        dy = (lat - alat) * 111.0
        d2 = dx * dx + dy * dy
        if d2 < 0.25:
            base = elev
            break
        w = 1 / d2**1.5
        num += w * elev
        den += w
    else:
        base = num / den
    return max(-20.0, base + _fbm(lon, lat, 11) * (60 + 0.25 * base))


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def synthetic(lon: float, lat: float) -> dict[str, object]:
    elev = _elevation(lon, lat)
    n = lambda seed: _fbm(lon, lat, seed)  # noqa: E731

    # Terrain: slope grows with relief; aspect is the downhill direction of the elevation field.
    step = 0.004
    gx = (_elevation(lon + step, lat) - _elevation(lon - step, lat)) / (2 * step * 85_000)
    gy = (_elevation(lon, lat + step) - _elevation(lon, lat - step)) / (2 * step * 111_000)
    aspect = (math.degrees(math.atan2(-gx, -gy)) + 360) % 360
    slope = _clamp((1 + 18 * (1 - math.exp(-elev / 900))) * (1 + 0.4 * n(21)), 0.2, 35)

    # Climate: lapse rates with elevation; lowlands warm, dry and sunny.
    temp = 14.8 - 0.0062 * elev + 0.6 * n(31)
    precip = _clamp(285 + 0.30 * elev + 60 * n(32), 220, 1250)
    frost_free = _clamp(245 - 0.065 * elev + 8 * n(33), 90, 260)
    ghi = 1500 - 0.05 * elev - 0.08 * (precip - 300) + 15 * n(34)

    # Soil: lowland soils alkaline and saline; mountain meadow soils rich in humus.
    salinity = _clamp(0.4 + 7.0 * math.exp(-max(elev, 0) / 180) * (1 + 0.4 * n(41)), 0.2, 12)
    ph = _clamp(8.4 - 0.0011 * elev + 0.25 * n(42), 5.5, 8.8)
    soc = _clamp(0.9 + 0.0013 * elev + 0.4 * n(43), 0.4, 5.0)
    nitrogen = _clamp(soc / 10 * (1 + 0.1 * n(44)), 0.03, 0.5)
    fertility = _clamp(
        55
        + 10 * (soc - 1.5)
        - 2.5 * max(0, salinity - 3)
        - 6 * max(0, abs(ph - 6.8) - 0.5)
        + 10 * n(45),
        15,
        92,
    )
    # Drinking water: springs are common in the mountains; the lowland depends on wells and
    # the village network, so the nearest source is usually farther away there.
    potable_km = _clamp(
        (0.35 + 1.8 * math.exp(-max(elev, 0) / 600)) * math.exp(2.2 * n(51)), 0.05, 8
    )

    t = n(46)
    if elev < 150:
        texture = "CLAY" if t > 0.2 else "CLAY_LOAM"
    elif elev < 700:
        texture = "CLAY_LOAM" if t > 0.4 else "LOAM"
    elif elev < 1600:
        texture = "SANDY_LOAM" if t > 0.3 else "LOAM"
    else:
        texture = "STONY" if t > -0.2 else "SANDY_LOAM"

    return {
        "elevation": round(elev),
        "slope": round(slope, 1),
        "aspect": round(aspect),
        "temp": round(temp, 1),
        "precip": round(precip),
        "frost_free": round(frost_free),
        "ghi": round(ghi),
        "salinity": round(salinity, 1),
        "ph": round(ph, 1),
        "soc": round(soc, 2),
        "nitrogen": round(nitrogen, 3),
        "fertility": round(fertility),
        "texture": texture,
        "potable": round(potable_km * 1000),
    }


class SyntheticSource:
    tag = "SYNTHETIC"

    def sample(self, points: list[Point], factors: set[str]) -> dict[str, dict[str, object]]:
        out = {}
        for p in points:
            values = synthetic(p.lon, p.lat)
            out[p.id] = {k: v for k, v in values.items() if k in factors}
        return out


class CsvSource:
    """Values from a CSV: rows keyed by `code` (area code / H3 index) or by nearest `lon,lat`."""

    tag = "CSV"

    def __init__(self, path: str, columns: dict[str, str], max_km: float = 2.0) -> None:
        with Path(path).open(encoding="utf-8") as fh:
            self.rows = list(csv.DictReader(fh))
        self.columns = columns
        self.max_km = max_km
        self.by_code = {r["code"]: r for r in self.rows if r.get("code")}

    def _nearest(self, p: Point) -> dict | None:
        best, best_d = None, self.max_km
        for r in self.rows:
            if not r.get("lon"):
                continue
            d = math.hypot((float(r["lon"]) - p.lon) * 85, (float(r["lat"]) - p.lat) * 111)
            if d <= best_d:
                best, best_d = r, d
        return best

    def sample(self, points: list[Point], factors: set[str]) -> dict[str, dict[str, object]]:
        out: dict[str, dict[str, object]] = {}
        for p in points:
            row = self.by_code.get(p.id) or self._nearest(p)
            if row is None:
                continue
            out[p.id] = {
                f: (row[col] if f == "texture" else float(row[col]))
                for f, col in self.columns.items()
                if f in factors and row.get(col) not in (None, "")
            }
        return out


def configured_sources() -> dict[str, FactorSource]:
    """Factor → adapter. Default: synthetic for every agronomic factor."""
    synthetic_source = SyntheticSource()
    mapping: dict[str, FactorSource] = dict.fromkeys(AGRONOMIC, synthetic_source)
    raw = get_settings().suitability_sources
    if not raw:
        return mapping
    config = json.loads(Path(raw).read_text(encoding="utf-8") if raw.endswith(".json") else raw)
    for factor, spec in config.items():
        if spec.get("adapter") == "csv":
            mapping[factor] = CsvSource(spec["path"], {factor: spec.get("column", factor)})
    return mapping


def sample(points: list[Point]) -> dict[str, dict[str, tuple[object, str]]]:
    """Value and source tag of every agronomic factor at every point. Missing real values fall
    back to the synthetic ones, still tagged as such."""
    mapping = configured_sources()
    out: dict[str, dict[str, tuple[object, str]]] = {p.id: {} for p in points}
    by_source: dict[int, tuple[FactorSource, set[str]]] = {}
    for factor, source in mapping.items():
        by_source.setdefault(id(source), (source, set()))[1].add(factor)
    for source, factors in by_source.values():
        for pid, values in source.sample(points, factors).items():
            for f, v in values.items():
                out[pid][f] = (v, source.tag)
    fallback = SyntheticSource()
    for p in points:
        missing = set(AGRONOMIC) - out[p.id].keys()
        if missing:
            for f, v in fallback.sample([p], missing)[p.id].items():
                out[p.id][f] = (v, fallback.tag)
    return out

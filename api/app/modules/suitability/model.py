"""Suitability model: membership functions, per-activity factor sets, two-level AHP.

For each activity the factors sit in four criteria groups (Torpaq, İqlim, Relyef, Su və
infrastruktur). Experts compare the groups pairwise on Saaty's 1–9 scale, and the factors
inside each group the same way; the principal eigenvector of each matrix gives the weights,
and a matrix is accepted only if its consistency ratio is below 0.1. A factor's global weight
is its group weight times its weight inside the group.

Score = 100 × Σ global weight × membership. FAO classes: S1 ≥ 75, S2 ≥ 50, S3 ≥ 25, else N.
Hard constraints (not cleared of mines; severe salinity for orchards) give N whatever the score.
Decision support only: the competition commission decides.
"""

import math
from dataclasses import dataclass

from app.modules.suitability.factors import FACTORS, GROUPS, TEXTURE_LABEL

ACTIVITIES = ("CROP", "ORCHARD", "LIVESTOCK", "OTHER")
ACTIVITY_LABEL = {
    "CROP": "Əkinçilik",
    "ORCHARD": "Bağçılıq",
    "LIVESTOCK": "Heyvandarlıq",
    "OTHER": "Digər (istixana, emal)",
}
THRESHOLDS = {"S1": 75, "S2": 50, "S3": 25}
RANDOM_INDEX = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45}
SAATY = (1, 2, 3, 4, 5, 6, 7, 8, 9)
SEVERE_SALINITY_ORCHARD = 6.0  # dS/m
ON_SITE_POTABLE_M = 300  # a drinking-water source this close counts as access on the plot
DISTANCES = ("water", "road", "settlement", "potable")  # stored in metres, shown in km
COMPASS = ("Şimal", "Şimal-şərq", "Şərq", "Cənub-şərq", "Cənub", "Cənub-qərb", "Qərb", "Şimal-qərb")


# ── Membership functions ────────────────────────────────────────────────────


def decreasing(x: float | None, good: float, poor: float) -> float:
    """1 up to `good`, 0 from `poor`, linear in between (distances, slope, salinity)."""
    if x is None:
        return 0.0
    if x <= good:
        return 1.0
    if x >= poor:
        return 0.0
    return round(1 - (x - good) / (poor - good), 3)


def increasing(x: float | None, poor: float, good: float) -> float:
    """0 up to `poor`, 1 from `good` (fertility, frost-free days, radiation)."""
    if x is None:
        return 0.0
    if x <= poor:
        return 0.0
    if x >= good:
        return 1.0
    return round((x - poor) / (good - poor), 3)


def trapezoid(x: float | None, a: float, b: float, c: float, d: float) -> float:
    """0 outside [a, d], 1 on [b, c], linear on the shoulders (pH, temperature, rainfall)."""
    if x is None or x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    return round((x - a) / (b - a) if x < b else (d - x) / (d - c), 3)


def south_facing(aspect: float | None, slope: float | None) -> float:
    """1 for south-facing slopes, 0 for north-facing; flat ground (< 2°) has no aspect."""
    if aspect is None or slope is None or slope < 2:
        return 1.0
    return round(0.5 + 0.5 * math.cos(math.radians(aspect - 180)), 3)


# Per activity: factor → membership rule. Distance rules are in metres.
RULES: dict[str, dict[str, tuple]] = {
    "CROP": {
        "fertility": ("inc", 30, 75),
        "salinity": ("dec", 2, 8),
        "ph": ("trap", 5.0, 6.0, 7.5, 8.6),
        "texture": (
            "cat",
            {"LOAM": 1.0, "CLAY_LOAM": 0.85, "SANDY_LOAM": 0.7, "CLAY": 0.6, "STONY": 0.3},
        ),
        "landcover": ("cover",),
        "precip": ("trap", 200, 450, 800, 1300),
        "frost_free": ("inc", 120, 200),
        "temp": ("trap", 4, 10, 16, 22),
        "slope": ("dec", 3, 15),
        "elevation": ("trap", -30, 0, 900, 1800),
        "water": ("dec", 300, 3000),
        "road": ("dec", 500, 8000),
        "settlement": ("dec", 1000, 10000),
        "potable": ("dec", 300, 5000),
    },
    "ORCHARD": {
        "salinity": ("dec", 1.5, 5),
        "ph": ("trap", 5.0, 6.0, 7.4, 8.4),
        "texture": (
            "cat",
            {"LOAM": 1.0, "SANDY_LOAM": 0.9, "CLAY_LOAM": 0.75, "CLAY": 0.5, "STONY": 0.5},
        ),
        "fertility": ("inc", 30, 70),
        "frost_free": ("inc", 150, 215),
        "ghi": ("inc", 1300, 1470),
        "temp": ("trap", 6, 10, 15, 20),
        "aspect": ("aspect",),
        "slope": ("dec", 8, 25),
        "elevation": ("trap", 0, 200, 1300, 1900),
        "water": ("dec", 300, 3000),
        "road": ("dec", 500, 6000),
        "potable": ("dec", 300, 5000),
    },
    "LIVESTOCK": {
        "landcover": ("cover",),
        "soc": ("inc", 0.8, 2.5),
        "precip": ("trap", 250, 500, 1100, 1500),
        "frost_free": ("inc", 90, 170),
        "slope": ("dec", 15, 35),
        "elevation": ("trap", -30, 200, 2500, 3200),
        "water": ("dec", 500, 4000),
        "road": ("dec", 1000, 15000),
        "settlement": ("dec", 1000, 12000),
        "potable": ("dec", 200, 3000),
    },
    "OTHER": {
        "salinity": ("dec", 4, 12),
        "ghi": ("inc", 1300, 1470),
        "temp": ("trap", 2, 9, 18, 26),
        "slope": ("dec", 3, 10),
        "road": ("dec", 300, 4000),
        "settlement": ("dec", 500, 6000),
        "water": ("dec", 500, 5000),
        "potable": ("dec", 200, 3000),
    },
}

# Default expert priorities (relative importance) per activity: groups, then factors per group.
# They are turned into Saaty pairwise matrices below; experts edit the matrices, not these.
DEFAULT_PRIORITIES: dict[str, dict] = {
    "CROP": {
        "groups": {"SOIL": 0.35, "CLIMATE": 0.25, "TERRAIN": 0.15, "ACCESS": 0.25},
        "SOIL": {
            "fertility": 0.35,
            "salinity": 0.25,
            "ph": 0.15,
            "landcover": 0.15,
            "texture": 0.10,
        },
        "CLIMATE": {"precip": 0.5, "frost_free": 0.3, "temp": 0.2},
        "TERRAIN": {"slope": 0.75, "elevation": 0.25},
        "ACCESS": {"water": 0.50, "road": 0.25, "settlement": 0.15, "potable": 0.10},
    },
    "ORCHARD": {
        "groups": {"SOIL": 0.30, "CLIMATE": 0.30, "TERRAIN": 0.20, "ACCESS": 0.20},
        "SOIL": {"salinity": 0.35, "ph": 0.25, "texture": 0.20, "fertility": 0.20},
        "CLIMATE": {"frost_free": 0.40, "ghi": 0.35, "temp": 0.25},
        "TERRAIN": {"aspect": 0.45, "slope": 0.35, "elevation": 0.20},
        "ACCESS": {"water": 0.55, "road": 0.35, "potable": 0.10},
    },
    "LIVESTOCK": {
        "groups": {"SOIL": 0.20, "CLIMATE": 0.25, "TERRAIN": 0.25, "ACCESS": 0.30},
        "SOIL": {"landcover": 0.6, "soc": 0.4},
        "CLIMATE": {"precip": 0.6, "frost_free": 0.4},
        "TERRAIN": {"slope": 0.6, "elevation": 0.4},
        "ACCESS": {"water": 0.40, "potable": 0.30, "road": 0.15, "settlement": 0.15},
    },
    "OTHER": {
        "groups": {"SOIL": 0.10, "CLIMATE": 0.30, "TERRAIN": 0.20, "ACCESS": 0.40},
        "SOIL": {"salinity": 1.0},
        "CLIMATE": {"ghi": 0.6, "temp": 0.4},
        "TERRAIN": {"slope": 1.0},
        "ACCESS": {"road": 0.40, "settlement": 0.25, "potable": 0.20, "water": 0.15},
    },
}


# ── AHP ──────────────────────────────────────────────────────────────────────


def to_saaty(ratio: float) -> float:
    """Nearest value on Saaty's scale (1/9 … 9), halves rounded up."""
    # Rounded first: 0.6 / 0.4 is 1.4999999999999998 in floating point.
    if ratio >= 1:
        return float(max(1, min(9, math.floor(round(ratio, 6) + 0.5))))
    return 1 / max(1, min(9, math.floor(round(1 / ratio, 6) + 0.5)))


def matrix_from_priorities(priorities: dict[str, float]) -> dict:
    """A reciprocal pairwise matrix whose entries are the priority ratios on Saaty's scale."""
    keys = list(priorities)
    n = len(keys)
    m = [[1.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            v = to_saaty(priorities[keys[i]] / priorities[keys[j]])
            m[i][j], m[j][i] = v, 1 / v
    return {"keys": keys, "matrix": m}


def ahp(matrix: list[list[float]]) -> tuple[list[float], float]:
    """Principal-eigenvector weights (power iteration) and the consistency ratio."""
    n = len(matrix)
    if n == 1:
        return [1.0], 0.0
    w = [1 / n] * n
    for _ in range(200):
        nxt = [sum(matrix[i][j] * w[j] for j in range(n)) for i in range(n)]
        total = sum(nxt)
        w = [x / total for x in nxt]
    if n <= 2:
        return w, 0.0
    lambda_max = sum(sum(matrix[i][j] * w[j] for j in range(n)) / w[i] for i in range(n)) / n
    return w, ((lambda_max - n) / (n - 1)) / RANDOM_INDEX[n]


# Group comparisons written as an expert would (row group vs column group), in the order
# SOIL, CLIMATE, TERRAIN, ACCESS.
GROUP_PAIRWISE: dict[str, dict[tuple[str, str], float]] = {
    # Field crops: soil and water first, then climate; relief matters least.
    "CROP": {
        ("SOIL", "CLIMATE"): 2,
        ("SOIL", "TERRAIN"): 3,
        ("SOIL", "ACCESS"): 1,
        ("CLIMATE", "TERRAIN"): 2,
        ("CLIMATE", "ACCESS"): 1 / 2,
        ("TERRAIN", "ACCESS"): 1 / 3,
    },
    # Orchards: soil and climate (frost, sun) first; relief and access equal.
    "ORCHARD": {
        ("SOIL", "CLIMATE"): 1,
        ("SOIL", "TERRAIN"): 2,
        ("SOIL", "ACCESS"): 2,
        ("CLIMATE", "TERRAIN"): 2,
        ("CLIMATE", "ACCESS"): 2,
        ("TERRAIN", "ACCESS"): 1,
    },
    # Pasture livestock: forage (grassland, humus) and rainfall first, then relief and access.
    "LIVESTOCK": {
        ("SOIL", "CLIMATE"): 1,
        ("SOIL", "TERRAIN"): 2,
        ("SOIL", "ACCESS"): 2,
        ("CLIMATE", "TERRAIN"): 2,
        ("CLIMATE", "ACCESS"): 2,
        ("TERRAIN", "ACCESS"): 1,
    },
    # Greenhouses and processing: access to roads and people first, then sun and warmth.
    "OTHER": {
        ("SOIL", "CLIMATE"): 1 / 3,
        ("SOIL", "TERRAIN"): 1 / 2,
        ("SOIL", "ACCESS"): 1 / 4,
        ("CLIMATE", "TERRAIN"): 2,
        ("CLIMATE", "ACCESS"): 1 / 2,
        ("TERRAIN", "ACCESS"): 1 / 2,
    },
}


def matrix_from_pairs(keys: list[str], pairs: dict[tuple[str, str], float]) -> dict:
    n = len(keys)
    m = [[1.0] * n for _ in range(n)]
    for (a, b), v in pairs.items():
        i, j = keys.index(a), keys.index(b)
        m[i][j], m[j][i] = float(v), 1 / v
    return {"keys": keys, "matrix": m}


def default_method() -> dict:
    """Pairwise matrices per activity: the group matrix and one matrix per group."""
    out = {}
    for activity, p in DEFAULT_PRIORITIES.items():
        out[activity] = {
            "groups": matrix_from_pairs(list(GROUPS), GROUP_PAIRWISE[activity]),
            "factors": {g: matrix_from_priorities(p[g]) for g in GROUPS},
        }
    return out


@dataclass
class Weights:
    groups: dict[str, float]  # group → weight
    local: dict[str, dict[str, float]]  # group → factor → weight inside the group
    cr: dict[str, float]  # "groups" or a group key → consistency ratio

    def global_weight(self, group: str, factor: str) -> float:
        return self.groups[group] * self.local[group][factor]

    @property
    def max_cr(self) -> float:
        return max(self.cr.values(), default=0.0)


def weights(activity_matrices: dict) -> Weights:
    g = activity_matrices["groups"]
    gw, gcr = ahp(g["matrix"])
    groups = dict(zip(g["keys"], gw, strict=True))
    local, cr = {}, {"groups": gcr}
    for group, fm in activity_matrices["factors"].items():
        fw, fcr = ahp(fm["matrix"])
        local[group] = dict(zip(fm["keys"], fw, strict=True))
        cr[group] = fcr
    return Weights(groups, local, cr)


# ── Assessment ──────────────────────────────────────────────────────────────


def fao_class(score: int) -> str:
    if score >= THRESHOLDS["S1"]:
        return "S1"
    if score >= THRESHOLDS["S2"]:
        return "S2"
    if score >= THRESHOLDS["S3"]:
        return "S3"
    return "N"


def membership(activity: str, factor: str, values: dict) -> float:
    rule = RULES[activity][factor]
    kind, x = rule[0], values.get(factor)
    if kind == "dec":
        return decreasing(x, rule[1], rule[2])
    if kind == "inc":
        return increasing(x, rule[1], rule[2])
    if kind == "trap":
        return trapezoid(x, *rule[1:])
    if kind == "cat":
        return rule[1].get(x, 0.5)
    if kind == "aspect":
        return south_facing(values.get("aspect"), values.get("slope"))
    if kind == "cover":
        return values.get("landcover_score", 0.5)
    raise ValueError(kind)


def display(factor: str, values: dict) -> tuple[float | None, str | None]:
    """Value for the table: a number with the catalogue's unit, or a text for categories."""
    if factor == "texture":
        return None, TEXTURE_LABEL.get(values.get("texture"), "—")
    if factor == "landcover":
        return None, values.get("landcover_text")
    x = values.get(factor)
    if x is None:
        return None, None
    if factor == "aspect":
        if (values.get("slope") or 0) < 2:
            return None, "Düz sahə (istiqamət yoxdur)"
        return round(x), f"{round(x)}° · {COMPASS[round(x / 45) % 8]}"
    if factor == "potable" and x <= ON_SITE_POTABLE_M:
        return round(x / 1000, 1), "Sahədə çıxış var (≤ 0,3 km)"
    if factor in DISTANCES:
        return round(x / 1000, 1), None
    return round(float(x), FACTORS[factor].decimals), None


def assess(activity: str, values: dict, sources: dict[str, str], w: Weights, demined: bool) -> dict:
    """Score, class, constraint and the grouped factor breakdown for one activity."""
    factors = {}
    total = 0.0
    for group, local in w.local.items():
        for factor in local:
            m = membership(activity, factor, values)
            gw = w.global_weight(group, factor)
            value, text = display(factor, values)
            factors[factor] = {
                "label": FACTORS[factor].label,
                "group": group,
                "value": value,
                "unit": "km" if factor in DISTANCES else FACTORS[factor].unit,
                "text": text,
                "membership": m,
                "weight": round(gw, 4),
                "local_weight": round(local[factor], 4),
                "contribution": round(100 * gw * m, 1),
                "source": sources.get(factor, "SYNTHETIC"),
            }
            total += gw * m
    score = round(100 * total)
    reason = None
    if not demined:
        reason = "Minatəmizləmə başa çatmayıb (nümayiş statusu)"
    elif activity == "ORCHARD" and (values.get("salinity") or 0) > SEVERE_SALINITY_ORCHARD:
        reason = f"Ağır şoranlaşma: EC {values['salinity']} dS/m > {SEVERE_SALINITY_ORCHARD:g} (bağ üçün yararsız)"
    factors["_groups"] = {
        g: {"label": GROUPS[g], "weight": round(v, 4)} for g, v in w.groups.items()
    }
    factors["_cr"] = round(w.max_cr, 3)
    return {
        "score": score,
        "fao_class": "N" if reason else fao_class(score),
        "constraint_reason": reason,
        "factors": factors,
    }

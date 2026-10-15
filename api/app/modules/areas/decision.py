"""Which of the compared plots fits best: TOPSIS, a transparent multi-criteria method.

No machine learning: there is no data on how past allocations turned out, so a model
would only pretend to know. TOPSIS ranks the plots by how close each one is to an
ideal plot (best value on every criterion) and how far from the worst, using weights
the user chooses. A sensitivity check perturbs those weights and reports whether the
first place holds. Decision support only.
"""

import math
import random
from dataclasses import dataclass, field

CRITERIA: dict[str, dict] = {
    "suitability": {"label": "Uyğunluq balı", "unit": "/100", "benefit": True},
    "fee": {"label": "İllik icarə haqqı", "unit": "AZN/ha", "benefit": False},
    "investment": {"label": "Minimum investisiya", "unit": "AZN", "benefit": False},
    "water": {"label": "Su mənbəyinə məsafə", "unit": "km", "benefit": False},
    "road": {"label": "Əsas yola məsafə", "unit": "km", "benefit": False},
}

PRESETS: dict[str, dict[str, float]] = {
    "balanced": {"suitability": 3, "fee": 2, "investment": 2, "water": 1.5, "road": 1.5},
    "suitability": {"suitability": 5, "fee": 1.5, "investment": 1.5, "water": 1, "road": 1},
    "cost": {"suitability": 2, "fee": 3.5, "investment": 3, "water": 0.75, "road": 0.75},
    "access": {"suitability": 2, "fee": 1, "investment": 1, "water": 3, "road": 3},
}

RUNS = 500
PERTURBATION = 0.2  # each weight varies by ±20 %
STABLE_SHARE = 0.8


@dataclass
class Alternative:
    code: str
    values: dict[str, float | None]  # raw values per criterion; None = unknown
    excluded_reason: str | None = None


@dataclass
class Result:
    weights: dict[str, float]
    closeness: dict[str, float]
    ranking: list[str]
    scores: dict[str, dict[str, float]]  # per criterion, per code: 0 (worst) … 1 (best)
    imputed: dict[str, list[str]]  # per code: criteria filled with the worst known value
    stability: float
    notes: list[str] = field(default_factory=list)


def normalise(weights: dict[str, float]) -> dict[str, float]:
    clean = {k: max(0.0, float(weights.get(k, 0))) for k in CRITERIA}
    total = sum(clean.values())
    if total == 0:
        return {k: 1 / len(CRITERIA) for k in CRITERIA}
    return {k: v / total for k, v in clean.items()}


def _complete(alts: list[Alternative]) -> tuple[dict[str, dict[str, float]], dict[str, list[str]]]:
    """Fills an unknown value with the worst known one, so missing data never helps a plot."""
    matrix: dict[str, dict[str, float]] = {a.code: {} for a in alts}
    imputed: dict[str, list[str]] = {a.code: [] for a in alts}
    for key, c in CRITERIA.items():
        known = [a.values[key] for a in alts if a.values.get(key) is not None]
        worst = (min(known) if c["benefit"] else max(known)) if known else 0.0
        for a in alts:
            value = a.values.get(key)
            if value is None:
                imputed[a.code].append(key)
                value = worst
            matrix[a.code][key] = float(value)
    return matrix, imputed


def topsis(matrix: dict[str, dict[str, float]], weights: dict[str, float]) -> dict[str, float]:
    codes = list(matrix)
    norms = {k: math.sqrt(sum(matrix[c][k] ** 2 for c in codes)) for k in CRITERIA}
    v = {
        c: {k: (matrix[c][k] / norms[k] if norms[k] else 0.0) * weights[k] for k in CRITERIA}
        for c in codes
    }
    best = {k: (max if CRITERIA[k]["benefit"] else min)(v[c][k] for c in codes) for k in CRITERIA}
    worst = {k: (min if CRITERIA[k]["benefit"] else max)(v[c][k] for c in codes) for k in CRITERIA}
    closeness = {}
    for c in codes:
        d_best = math.sqrt(sum((v[c][k] - best[k]) ** 2 for k in CRITERIA))
        d_worst = math.sqrt(sum((v[c][k] - worst[k]) ** 2 for k in CRITERIA))
        closeness[c] = d_worst / (d_best + d_worst) if d_best + d_worst else 0.5
    return closeness


def _relative(matrix: dict[str, dict[str, float]]) -> dict[str, dict[str, float]]:
    """Per criterion, 1 for the best plot and 0 for the worst (for the explanation table)."""
    scores: dict[str, dict[str, float]] = {}
    for key, c in CRITERIA.items():
        values = {code: row[key] for code, row in matrix.items()}
        lo, hi = min(values.values()), max(values.values())
        scores[key] = {
            code: 1.0
            if hi == lo
            else ((x - lo) / (hi - lo) if c["benefit"] else (hi - x) / (hi - lo))
            for code, x in values.items()
        }
    return scores


def rank(alternatives: list[Alternative], weights: dict[str, float]) -> Result:
    w = normalise(weights)
    candidates = [a for a in alternatives if a.excluded_reason is None]
    notes = [f"{a.code}: {a.excluded_reason}" for a in alternatives if a.excluded_reason]
    if len(candidates) < 2:
        only = [a.code for a in candidates]
        return Result(w, dict.fromkeys(only, 1.0), only, {}, {c: [] for c in only}, 1.0, notes)

    matrix, imputed = _complete(candidates)
    closeness = topsis(matrix, w)
    ranking = sorted(closeness, key=lambda c: -closeness[c])

    # Sensitivity: does the first place survive when every weight moves by up to ±20 %?
    rng = random.Random(2026)  # noqa: S311 - reproducible simulation, not security
    same_top = 0
    for _ in range(RUNS):
        jittered = normalise({k: w[k] * rng.uniform(1 - PERTURBATION, 1 + PERTURBATION) for k in w})
        trial = topsis(matrix, jittered)
        same_top += max(trial, key=lambda c: trial[c]) == ranking[0]
    return Result(w, closeness, ranking, _relative(matrix), imputed, same_top / RUNS, notes)

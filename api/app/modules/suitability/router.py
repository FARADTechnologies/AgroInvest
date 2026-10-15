from fastapi import APIRouter
from pydantic import BaseModel

from app.core.deps import SessionDep
from app.modules.suitability import model, service, sources
from app.modules.suitability.factors import FACTORS, GROUPS, MEASURED, SOURCE_LABEL

router = APIRouter(prefix="/suitability", tags=["suitability method (public)"])


class MatrixOut(BaseModel):
    keys: list[str]
    labels: list[str]
    matrix: list[list[float]]
    weights: list[float]
    cr: float


class ActivityMethodOut(BaseModel):
    activity: str
    label: str
    groups: MatrixOut
    factors: dict[str, MatrixOut]
    rules: dict[str, list]


class FactorOut(BaseModel):
    key: str
    label: str
    group: str
    unit: str
    source: str
    source_label: str
    planned_source: str


class MethodOut(BaseModel):
    version: str
    comment: str | None
    created_at: str
    thresholds: dict[str, int]
    groups: dict[str, str]
    factors: list[FactorOut]
    activities: list[ActivityMethodOut]
    max_cr: float = 0.1


def _matrix(m: dict, labels: dict[str, str]) -> MatrixOut:
    w, cr = model.ahp(m["matrix"])
    return MatrixOut(
        keys=m["keys"],
        labels=[labels[k] for k in m["keys"]],
        matrix=[[round(x, 4) for x in row] for row in m["matrix"]],
        weights=[round(x, 4) for x in w],
        cr=round(cr, 4),
    )


def describe(version: str, comment: str | None, created_at: str, matrices: dict) -> MethodOut:
    configured = sources.configured_sources()
    factor_labels = {k: f.label for k, f in FACTORS.items()}
    activities = [
        ActivityMethodOut(
            activity=a,
            label=model.ACTIVITY_LABEL[a],
            groups=_matrix(matrices[a]["groups"], GROUPS),
            factors={g: _matrix(fm, factor_labels) for g, fm in matrices[a]["factors"].items()},
            rules={f: list(rule) for f, rule in model.RULES[a].items()},
        )
        for a in model.ACTIVITIES
    ]
    factors = []
    for key, f in FACTORS.items():
        tag = "OSM" if key in MEASURED else configured[key].tag
        factors.append(
            FactorOut(
                key=key,
                label=f.label,
                group=f.group,
                unit=f.unit,
                source=tag,
                source_label=SOURCE_LABEL[tag],
                planned_source=f.planned_source,
            )
        )
    return MethodOut(
        version=version,
        comment=comment,
        created_at=created_at,
        thresholds=model.THRESHOLDS,
        groups=GROUPS,
        factors=factors,
        activities=activities,
    )


@router.get(
    "/method",
    response_model=MethodOut,
    summary="The suitability method in force: AHP matrices, weights, CR, classes, data sources",
)
async def current_method(session: SessionDep) -> MethodOut:
    method = await service.active_method(session)
    await session.commit()
    return describe(method.version, method.comment, method.created_at.isoformat(), method.matrices)

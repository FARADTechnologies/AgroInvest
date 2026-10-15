"""Experts maintain the method: they edit the AHP pairwise matrices and publish a new version.

A version is accepted only if every matrix is reciprocal, on Saaty's 1–9 scale and has a
consistency ratio below 0.1. Publishing re-scores every farm area and is audited.
"""

from datetime import datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.deps import SessionDep, SpecialistUser, StaffUser
from app.core.errors import unprocessable
from app.modules.areas.models import AreaSuitability
from app.modules.audit import service as audit
from app.modules.identity.models import User
from app.modules.suitability import model, service
from app.modules.suitability.factors import GROUPS
from app.modules.suitability.models import SuitabilityMethod
from app.modules.suitability.router import MethodOut, describe

router = APIRouter(prefix="/admin/suitability", tags=["suitability method (staff)"])

MAX_CR = 0.1
_SCALE = [*model.SAATY, *(1 / s for s in model.SAATY)]


class VersionOut(BaseModel):
    version: str
    active: bool
    comment: str | None
    created_at: datetime
    created_by: str | None
    max_cr: float


class Matrix(BaseModel):
    keys: list[str]
    matrix: list[list[float]]


class ActivityMatrices(BaseModel):
    groups: Matrix
    factors: dict[str, Matrix]


class MethodIn(BaseModel):
    matrices: dict[str, ActivityMatrices]
    comment: str = Field(min_length=3, max_length=500)


class PublishOut(BaseModel):
    version: str
    rescored: int
    class_changes: int
    max_cr: float


def _max_cr(matrices: dict) -> float:
    return max(model.weights(matrices[a]).max_cr for a in model.ACTIVITIES)


@router.get("/methods", response_model=list[VersionOut], summary="Method versions, newest first")
async def versions(session: SessionDep, _: StaffUser) -> list[VersionOut]:
    await service.active_method(session)
    rows = (
        await session.execute(
            select(SuitabilityMethod, User.full_name)
            .outerjoin(User, User.id == SuitabilityMethod.created_by)
            .order_by(SuitabilityMethod.created_at.desc())
        )
    ).all()
    await session.commit()
    return [
        VersionOut(
            version=m.version,
            active=m.active,
            comment=m.comment,
            created_at=m.created_at,
            created_by=name,
            max_cr=round(_max_cr(m.matrices), 4),
        )
        for m, name in rows
    ]


@router.get("/default", response_model=MethodOut, summary="The built-in expert matrices")
async def default(_: StaffUser) -> MethodOut:
    return describe("standart", "Standart ekspert matrisləri", "", model.default_method())


def _clean(activity: str, which: str, given: Matrix, expected: list[str]) -> dict:
    """Checks one matrix and rebuilds it from its upper triangle, so it is exactly reciprocal."""
    where = f"{model.ACTIVITY_LABEL[activity]} · {GROUPS.get(which, 'qruplar')}"
    if given.keys != expected:
        raise unprocessable("matrix_keys", f"{where}: amillərin siyahısı dəyişdirilə bilməz")
    n = len(expected)
    if len(given.matrix) != n or any(len(row) != n for row in given.matrix):
        raise unprocessable("matrix_shape", f"{where}: matris {n}×{n} olmalıdır")
    m = [[1.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            v = given.matrix[i][j]
            if v <= 0 or min(abs(v - s) for s in _SCALE) > 1e-3:
                raise unprocessable("saaty_scale", f"{where}: dəyərlər Saaty şkalasında (1/9 … 9) olmalıdır")
            exact = min(_SCALE, key=lambda s: abs(v - s))
            m[i][j], m[j][i] = exact, 1 / exact
    _, cr = model.ahp(m)
    if cr >= MAX_CR:
        raise unprocessable("inconsistent", f"{where}: uyğunluq nisbəti CR = {cr:.3f} ≥ {MAX_CR} — matris ziddiyyətlidir")
    return {"keys": expected, "matrix": m}


@router.post(
    "/methods",
    response_model=PublishOut,
    status_code=201,
    summary="Publish new AHP matrices as the next method version and re-score every area",
)
async def publish(data: MethodIn, request: Request, session: SessionDep, user: SpecialistUser) -> PublishOut:
    reference = model.default_method()
    if set(data.matrices) != set(model.ACTIVITIES):
        raise unprocessable("activities", "Bütün fəaliyyət növləri üçün matrislər göndərilməlidir")
    matrices = {}
    for activity in model.ACTIVITIES:
        given, ref = data.matrices[activity], reference[activity]
        if set(given.factors) != set(ref["factors"]):
            raise unprocessable("groups", f"{model.ACTIVITY_LABEL[activity]}: meyar qrupları dəyişdirilə bilməz")
        matrices[activity] = {
            "groups": _clean(activity, "groups", given.groups, ref["groups"]["keys"]),
            "factors": {
                g: _clean(activity, g, given.factors[g], ref["factors"][g]["keys"]) for g in ref["factors"]
            },
        }

    def classes(rows) -> dict:
        return {(r.farm_area_id, r.activity): r.fao_class for r in rows}

    before = classes((await session.scalars(select(AreaSuitability))).all())
    method = await service.activate(session, matrices, data.comment.strip(), user.id)
    after = classes((await session.scalars(select(AreaSuitability))).all())
    changes = sum(1 for k, c in after.items() if before.get(k) != c)
    rescored = len({area for area, _ in after})
    max_cr = round(_max_cr(matrices), 4)
    audit.record(
        session,
        user,
        "suitability.method",
        "suitability_method",
        method.version,
        {"comment": method.comment, "max_cr": max_cr, "rescored": rescored, "class_changes": changes},
        request.client.host if request.client else None,
    )
    await session.commit()
    return PublishOut(version=method.version, rescored=rescored, class_changes=changes, max_cr=max_cr)

"""Experts publish new AHP matrices: validation, CR gate, versioning, re-scoring and audit."""

import copy

from app.modules.suitability import model

from .conftest import login


def _payload(matrices: dict, comment: str = "Ekspert şurasının qərarı") -> dict:
    return {"matrices": matrices, "comment": comment}


def _set(m: dict, a: str, b: str, value: float) -> None:
    i, j = m["keys"].index(a), m["keys"].index(b)
    m["matrix"][i][j], m["matrix"][j][i] = value, 1 / value


async def test_an_inconsistent_matrix_cannot_be_saved(specialist):
    matrices = copy.deepcopy(model.default_method())
    g = matrices["CROP"]["groups"]
    # Soil ≫ climate ≫ terrain, yet terrain ≫ soil: intransitive.
    _set(g, "SOIL", "CLIMATE", 7)
    _set(g, "CLIMATE", "TERRAIN", 7)
    _set(g, "SOIL", "TERRAIN", 1 / 7)
    r = await specialist.post("/api/v1/admin/suitability/methods", json=_payload(matrices))
    assert r.status_code == 422
    assert "CR" in r.json()["detail"]


async def test_values_off_saatys_scale_are_rejected(specialist):
    matrices = copy.deepcopy(model.default_method())
    _set(matrices["ORCHARD"]["groups"], "SOIL", "CLIMATE", 2.5)
    r = await specialist.post("/api/v1/admin/suitability/methods", json=_payload(matrices))
    assert r.status_code == 422 and r.json()["title"] == "saaty_scale"


async def test_the_factor_set_cannot_be_changed(specialist):
    matrices = copy.deepcopy(model.default_method())
    soil = matrices["CROP"]["factors"]["SOIL"]
    soil["keys"] = list(reversed(soil["keys"]))
    r = await specialist.post("/api/v1/admin/suitability/methods", json=_payload(matrices))
    assert r.status_code == 422 and r.json()["title"] == "matrix_keys"


async def test_only_specialists_and_admins_publish(client):
    await login(client, "sahibkar@agro-demo.test")
    r = await client.post("/api/v1/admin/suitability/methods", json=_payload(model.default_method()))
    assert r.status_code == 403
    await login(client, "rehber@agro-demo.test")
    assert (await client.get("/api/v1/admin/suitability/methods")).status_code == 200
    r = await client.post("/api/v1/admin/suitability/methods", json=_payload(model.default_method()))
    assert r.status_code == 403


async def test_publishing_creates_a_version_rescores_and_is_audited(specialist):
    matrices = copy.deepcopy(model.default_method())
    # Water and access matter more for field crops than the default says.
    _set(matrices["CROP"]["groups"], "SOIL", "ACCESS", 1 / 2)
    r = await specialist.post("/api/v1/admin/suitability/methods", json=_payload(matrices, "Su prioriteti"))
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["version"].startswith("mcda-2.") and out["max_cr"] < 0.1 and out["rescored"] > 0

    method = (await specialist.get("/api/v1/suitability/method")).json()
    assert method["version"] == out["version"] and method["comment"] == "Su prioriteti"
    crop = next(a for a in method["activities"] if a["activity"] == "CROP")
    weights = dict(zip(crop["groups"]["keys"], crop["groups"]["weights"], strict=True))
    assert weights["ACCESS"] > weights["SOIL"]

    area = (await specialist.get("/api/v1/areas/AGM-0001")).json()
    assert {s["factors"]["_method"] for s in area["suitability"]} == {out["version"]}

    versions = (await specialist.get("/api/v1/admin/suitability/methods")).json()
    assert versions[0]["version"] == out["version"] and versions[0]["active"]
    assert sum(v["active"] for v in versions) == 1
    assert versions[0]["created_by"]

    await login(specialist, "rehber@agro-demo.test")
    log = (await specialist.get("/api/v1/admin/audit", params={"limit": 20})).json()
    entries = log["items"] if isinstance(log, dict) else log
    assert any(e["action"] == "suitability.method" and e["entity_id"] == out["version"] for e in entries)

    # Back to the built-in matrices for whatever runs next.
    await login(specialist, "mutexessis@agro-demo.test")
    r = await specialist.post(
        "/api/v1/admin/suitability/methods", json=_payload(model.default_method(), "Standarta qaytarıldı")
    )
    assert r.status_code == 201

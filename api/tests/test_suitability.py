"""Suitability: AHP weights and consistency, membership functions, hard constraints, demo factor
values, the grouped breakdown on the area page and the published methodology."""

import pytest

from app.modules.suitability import model, sources
from app.modules.suitability.factors import FACTORS, GROUPS

from .test_admin_areas import _point_in_rayon, _square

DEFAULT = model.default_method()


# ── AHP ──────────────────────────────────────────────────────────────────────


def test_ahp_of_a_consistent_matrix_recovers_the_priorities():
    m = model.matrix_from_pairs(["a", "b", "c"], {("a", "b"): 2, ("a", "c"): 4, ("b", "c"): 2})
    w, cr = model.ahp(m["matrix"])
    assert [round(x, 4) for x in w] == [0.5714, 0.2857, 0.1429]
    assert cr < 1e-9


def test_ahp_flags_an_inconsistent_matrix():
    # a > b, b > c, but c > a: intransitive.
    m = model.matrix_from_pairs(["a", "b", "c"], {("a", "b"): 5, ("a", "c"): 1 / 5, ("b", "c"): 5})
    _, cr = model.ahp(m["matrix"])
    assert cr >= 0.1


def test_matrices_are_reciprocal_and_on_saatys_scale():
    for activity in model.ACTIVITIES:
        mats = [DEFAULT[activity]["groups"], *DEFAULT[activity]["factors"].values()]
        for m in mats:
            n = len(m["keys"])
            for i in range(n):
                for j in range(n):
                    v = m["matrix"][i][j]
                    assert abs(v * m["matrix"][j][i] - 1) < 1e-9
                    assert (
                        min(abs(v - s) for s in [*model.SAATY, *(1 / s for s in model.SAATY)])
                        < 1e-9
                    )


@pytest.mark.parametrize("activity", model.ACTIVITIES)
def test_default_weights_are_consistent(activity):
    w = model.weights(DEFAULT[activity])
    assert abs(sum(w.groups.values()) - 1) < 1e-9
    total = sum(w.global_weight(g, f) for g, local in w.local.items() for f in local)
    assert abs(total - 1) < 1e-9
    assert w.max_cr < 0.1, f"{activity}: CR {w.cr}"
    # Every rule of the activity has a weight, and nothing else does.
    assert {f for local in w.local.values() for f in local} == set(model.RULES[activity])


def test_soil_and_water_lead_for_field_crops():
    w = model.weights(DEFAULT["CROP"])
    assert w.groups["SOIL"] > w.groups["CLIMATE"] > w.groups["TERRAIN"]
    assert w.groups["ACCESS"] > w.groups["TERRAIN"]


# ── Membership functions ────────────────────────────────────────────────────


def test_decreasing_membership():
    assert model.decreasing(100, 300, 3000) == 1.0
    assert model.decreasing(3000, 300, 3000) == 0.0
    assert model.decreasing(1650, 300, 3000) == 0.5
    assert model.decreasing(None, 300, 3000) == 0.0


def test_increasing_membership():
    assert model.increasing(20, 30, 75) == 0.0
    assert model.increasing(75, 30, 75) == 1.0
    assert model.increasing(52.5, 30, 75) == 0.5


def test_trapezoid_membership():
    assert model.trapezoid(4.9, 5.0, 6.0, 7.5, 8.6) == 0.0
    assert model.trapezoid(6.8, 5.0, 6.0, 7.5, 8.6) == 1.0
    assert model.trapezoid(5.5, 5.0, 6.0, 7.5, 8.6) == 0.5
    assert model.trapezoid(8.05, 5.0, 6.0, 7.5, 8.6) == 0.5
    assert model.trapezoid(9.0, 5.0, 6.0, 7.5, 8.6) == 0.0


def test_aspect_membership_prefers_south_slopes():
    assert model.south_facing(180, 10) == 1.0
    assert model.south_facing(0, 10) == 0.0
    assert model.south_facing(90, 10) == 0.5
    assert model.south_facing(0, 1) == 1.0  # flat ground has no aspect
    assert model.display("aspect", {"aspect": 170, "slope": 8}) == (170, "170° · Cənub")
    assert model.display("aspect", {"aspect": 170, "slope": 1})[1].startswith("Düz sahə")


# ── Constraints ─────────────────────────────────────────────────────────────


def _good_place() -> dict:
    values = sources.synthetic(47.13, 40.37)  # Bərdə lowland
    values.update(water=200, road=300, settlement=500, landcover_score=1.0, landcover_text="x")
    return values


def test_area_not_cleared_of_mines_is_class_n():
    w = model.weights(DEFAULT["CROP"])
    r = model.assess("CROP", _good_place(), {}, w, demined=False)
    assert r["fao_class"] == "N" and "Minatəmizləmə" in r["constraint_reason"]
    assert r["score"] > 0  # the score is still shown, the class says why it cannot be used


def test_severe_salinity_rules_out_orchards_only():
    values = {**_good_place(), "salinity": 7.5}
    orchard = model.assess("ORCHARD", values, {}, model.weights(DEFAULT["ORCHARD"]), demined=True)
    assert orchard["fao_class"] == "N" and "şoranlaşma" in orchard["constraint_reason"]
    crop = model.assess("CROP", values, {}, model.weights(DEFAULT["CROP"]), demined=True)
    assert crop["constraint_reason"] is None


def test_drinking_water_on_the_plot_is_called_out():
    w = model.weights(DEFAULT["LIVESTOCK"])
    near = model.assess("LIVESTOCK", {**_good_place(), "potable": 150}, {}, w, demined=True)
    far = model.assess("LIVESTOCK", {**_good_place(), "potable": 4000}, {}, w, demined=True)
    assert near["factors"]["potable"]["text"].startswith("Sahədə çıxış var")
    assert far["factors"]["potable"]["text"] is None and far["factors"]["potable"]["value"] == 4.0
    assert near["score"] > far["score"]


def test_contributions_add_up_to_the_score():
    w = model.weights(DEFAULT["CROP"])
    r = model.assess("CROP", _good_place(), {}, w, demined=True)
    total = sum(f["contribution"] for k, f in r["factors"].items() if not k.startswith("_"))
    assert abs(total - r["score"]) <= 1
    assert r["fao_class"] == model.fao_class(r["score"])


# ── Demo factor values ──────────────────────────────────────────────────────


def test_synthetic_values_are_deterministic_and_complete():
    a, b = sources.synthetic(46.75, 39.76), sources.synthetic(46.75, 39.76)
    assert a == b
    assert set(sources.AGRONOMIC) == a.keys()


def test_lowland_is_drier_warmer_and_more_saline_than_the_mountains():
    lowland = sources.synthetic(47.46, 40.05)  # Ağcabədi
    mountain = sources.synthetic(46.10, 40.30)  # Kəlbəcər
    assert lowland["elevation"] < 200 < 1500 < mountain["elevation"]
    assert lowland["precip"] < mountain["precip"]
    assert lowland["temp"] > mountain["temp"]
    assert lowland["frost_free"] > mountain["frost_free"]
    assert lowland["salinity"] > mountain["salinity"]
    assert lowland["slope"] < mountain["slope"]


def test_nearby_places_get_similar_values():
    a, b = sources.synthetic(46.900, 39.600), sources.synthetic(46.905, 39.602)
    assert abs(a["elevation"] - b["elevation"]) < 60
    assert abs(a["precip"] - b["precip"]) < 30


def test_a_csv_source_replaces_a_factor(tmp_path, monkeypatch):
    csv_file = tmp_path / "ph.csv"
    csv_file.write_text("code,ph\nAGM-0001,6.4\n", encoding="utf-8")
    monkeypatch.setattr(
        sources,
        "get_settings",
        lambda: type(
            "S",
            (),
            {
                "suitability_sources": f'{{"ph": {{"adapter": "csv", "path": "{csv_file.as_posix()}"}}}}'
            },
        )(),
    )
    out = sources.sample([sources.Point("AGM-0001", 47.0, 40.0), sources.Point("X", 47.0, 40.0)])
    assert out["AGM-0001"]["ph"] == (6.4, "CSV")
    assert out["X"]["ph"][1] == "SYNTHETIC"  # no row: falls back, still labelled as demo
    assert out["AGM-0001"]["salinity"][1] == "SYNTHETIC"


# ── API ─────────────────────────────────────────────────────────────────────


async def test_area_detail_explains_every_activity_by_group(client):
    body = (await client.get("/api/v1/areas/AGM-0001")).json()
    rows = {s["activity"]: s for s in body["suitability"]}
    assert set(rows) == set(model.ACTIVITIES)
    crop = rows["CROP"]
    assert crop["fao_class"] in {"S1", "S2", "S3", "N"}
    factors = crop["factors"]
    assert set(model.RULES["CROP"]) <= factors.keys()
    assert factors["_method"].startswith("mcda-2") and factors["_cr"] < 0.1
    assert set(factors["_groups"]) == set(GROUPS)
    assert factors["road"]["source"] == "OSM" and factors["road"]["value"] is not None
    assert factors["salinity"]["source"] == "SYNTHETIC"
    assert factors["fertility"]["group"] == "SOIL" and factors["precip"]["group"] == "CLIMATE"
    total = sum(f["contribution"] for k, f in factors.items() if not k.startswith("_"))
    assert abs(total - crop["score"]) <= 1
    assert body["dist_road_m"] is not None and body["dist_water_m"] is not None


async def test_area_not_cleared_of_mines_is_not_suitable(client):
    body = (await client.get("/api/v1/areas/AGM-0002")).json()
    assert body["demining_status"] != "CLEARED"
    assert {s["fao_class"] for s in body["suitability"]} == {"N"}
    assert all(s["constraint_reason"] for s in body["suitability"])


async def test_osm_farmland_scores_crop_landcover_fully(client):
    body = (await client.get("/api/v1/areas/AGM-0001")).json()  # OSM farmland
    crop = next(s for s in body["suitability"] if s["activity"] == "CROP")
    assert crop["factors"]["landcover"]["membership"] == 1.0


async def test_methodology_is_published(client):
    body = (await client.get("/api/v1/suitability/method")).json()
    assert body["version"].startswith("mcda-2")
    assert body["thresholds"] == {"S1": 75, "S2": 50, "S3": 25}
    assert {a["activity"] for a in body["activities"]} == set(model.ACTIVITIES)
    for a in body["activities"]:
        assert a["groups"]["cr"] < 0.1 and abs(sum(a["groups"]["weights"]) - 1) < 1e-3
    by_key = {f["key"]: f for f in body["factors"]}
    assert by_key.keys() == FACTORS.keys()
    assert by_key["ph"]["source"] == "SYNTHETIC" and by_key["ph"]["planned_source"]
    assert by_key["road"]["source"] == "OSM"


async def test_a_new_plot_is_scored_when_added(specialist):
    lon, lat = await _point_in_rayon(specialist, "Füzuli")
    r = await specialist.post(
        "/api/v1/admin/areas",
        json={"geometry": _square(lon, lat), "purpose": "ORCHARD", "demining_status": "CLEARED"},
    )
    assert r.status_code == 201, r.text
    detail = (await specialist.get(f"/api/v1/areas/{r.json()['code']}")).json()
    assert len(detail["suitability"]) == len(model.ACTIVITIES)
    crop = next(s for s in detail["suitability"] if s["activity"] == "CROP")
    assert crop["factors"]["landcover"]["text"].startswith("Məlum deyil")
    assert crop["factors"]["elevation"]["source"] == "SYNTHETIC"
    assert {s["fao_class"] for s in detail["suitability"]} <= {"S1", "S2", "S3", "N"}

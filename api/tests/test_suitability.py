"""Suitability scores: AHP weights, factor breakdown, the demining constraint, new plots."""

import pytest

from app.modules.areas import suitability
from app.modules.areas.models import Purpose

from .test_admin_areas import _point_in_rayon, _square


@pytest.mark.parametrize("activity", suitability.ACTIVITIES)
def test_ahp_weights_are_consistent(activity):
    weights, cr = suitability.WEIGHTS[activity]
    assert abs(sum(weights.values()) - 1) < 1e-9
    assert cr < 0.1, f"{activity} matrix is inconsistent (CR={cr:.3f})"


def test_linear_membership():
    assert suitability.linear(100, 300, 3000) == 1.0
    assert suitability.linear(3000, 300, 3000) == 0.0
    assert suitability.linear(1650, 300, 3000) == 0.5
    assert suitability.linear(None, 300, 3000) == 0.0


async def test_area_detail_explains_every_activity(client):
    body = (await client.get("/api/v1/areas/AGM-0001")).json()
    rows = {s["activity"]: s for s in body["suitability"]}
    assert set(rows) == {"CROP", "ORCHARD", "LIVESTOCK"}
    crop = rows["CROP"]
    assert 0 <= crop["score"] <= 100
    assert crop["fao_class"] == suitability.fao_class(crop["score"]).value
    factors = crop["factors"]
    assert {"water", "road", "settlement", "landcover", "terrain"} <= factors.keys()
    assert factors["_method"] == suitability.METHOD and factors["_cr"] < 0.1
    assert factors["road"]["value"] is not None  # measured against the OSM roads
    total = sum(f["weight"] * f["membership"] for k, f in factors.items() if not k.startswith("_"))
    assert abs(100 * total - crop["score"]) <= 1
    # Distances are stored on the area too, for the facts table.
    assert body["dist_road_m"] is not None and body["dist_water_m"] is not None


async def test_area_not_cleared_of_mines_is_not_suitable(client):
    body = (await client.get("/api/v1/areas/AGM-0002")).json()
    assert body["demining_status"] != "CLEARED"
    assert {s["fao_class"] for s in body["suitability"]} == {"N"}
    assert all(s["constraint_reason"] for s in body["suitability"])


async def test_osm_farmland_scores_crop_landcover_fully(client):
    body = (await client.get("/api/v1/areas/AGM-0001")).json()  # OSM farmland
    crop = next(s for s in body["suitability"] if s["activity"] == Purpose.CROP.value)
    assert crop["factors"]["landcover"]["membership"] == 1.0


async def test_a_new_plot_is_scored_when_added(specialist):
    lon, lat = await _point_in_rayon(specialist, "Füzuli")
    r = await specialist.post(
        "/api/v1/admin/areas",
        json={"geometry": _square(lon, lat), "purpose": "ORCHARD", "demining_status": "CLEARED"},
    )
    assert r.status_code == 201, r.text
    detail = (await specialist.get(f"/api/v1/areas/{r.json()['code']}")).json()
    assert len(detail["suitability"]) == 3
    orchard = next(s for s in detail["suitability"] if s["activity"] == "ORCHARD")
    assert orchard["factors"]["landcover"]["text"].startswith("Məlum deyil")
    assert orchard["fao_class"] in {"S1", "S2", "S3", "N"}

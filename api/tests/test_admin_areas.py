"""Areas added by staff: size, rayon and settlement are derived on the server."""


def _square(lon: float, lat: float, d: float = 0.004) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [
            [[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d], [lon, lat]]
        ],
    }


async def _point_in_rayon(client, rayon: str) -> tuple[float, float]:
    body = (await client.get("/api/v1/areas", params={"q": rayon, "size": 1})).json()
    lon, lat = body["items"][0]["centroid"]
    return lon + 0.01, lat + 0.01


async def test_create_area_derives_size_and_rayon(specialist):
    lon, lat = await _point_in_rayon(specialist, "Ağdam")
    r = await specialist.post(
        "/api/v1/admin/areas",
        json={
            "geometry": _square(lon, lat),
            "purpose": "CROP",
            "demining_status": "CLEARED",
            "irrigation": "CANAL",
            "lease_term_years": 25,
        },
    )
    assert r.status_code == 201, r.text
    area = r.json()
    assert area["code"].startswith("AGM-")
    assert area["rayon_name"] == "Ağdam"
    assert 10 < float(area["area_ha"]) < 25  # ~0.004° square at 40°N
    assert area["data_source"] == "MANUAL"


async def test_geometry_outside_azerbaijan_is_rejected(specialist):
    r = await specialist.post(
        "/api/v1/admin/areas", json={"geometry": _square(44.5, 40.2), "purpose": "CROP"}
    )
    assert r.status_code == 422


async def test_area_in_competition_cannot_change_geometry(specialist):
    rows = (await specialist.get("/api/v1/admin/areas", params={"status": "IN_COMPETITION"})).json()
    target = rows[0]
    r = await specialist.patch(f"/api/v1/admin/areas/{target['id']}", json={"purpose": "OTHER"})
    assert r.status_code == 409
    ok = await specialist.patch(
        f"/api/v1/admin/areas/{target['id']}", json={"soil_type": "Boz-qəhvəyi torpaq"}
    )
    assert ok.status_code == 200


async def test_entrepreneurs_cannot_manage_areas(investor):
    assert (await investor.get("/api/v1/admin/areas")).status_code == 403

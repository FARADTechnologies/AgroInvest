from shapely.geometry import Point, shape


async def test_catalogue_lists_public_areas_with_counts(client):
    response = await client.get("/api/v1/areas", params={"size": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] > 40
    assert set(body["purpose_counts"]) == {"CROP", "LIVESTOCK", "ORCHARD", "OTHER"}
    first = body["items"][0]
    assert first["competition"]["is_open"] is True  # default sort: nearest open deadline first


async def test_purpose_filter_and_open_only(client):
    body = (
        await client.get("/api/v1/areas", params={"purpose": "LIVESTOCK", "open_only": "true"})
    ).json()
    assert body["total"] > 0
    assert all(i["purpose"] == "LIVESTOCK" and i["competition"]["is_open"] for i in body["items"])


async def test_search_ignores_azerbaijani_diacritics(client):
    plain = (await client.get("/api/v1/areas", params={"q": "agdam"})).json()
    exact = (await client.get("/api/v1/areas", params={"q": "Ağdam"})).json()
    assert plain["total"] == exact["total"] > 0


async def test_geojson_for_map(client):
    body = (await client.get("/api/v1/areas/geojson")).json()
    assert body["type"] == "FeatureCollection"
    feature = body["features"][0]
    assert feature["geometry"]["type"] == "MultiPolygon"
    assert {"code", "purpose", "area_ha", "open"} <= feature["properties"].keys()


async def test_area_detail_has_terms_documents_and_geometry(client):
    code = (await client.get("/api/v1/areas", params={"open_only": "true", "size": 1})).json()[
        "items"
    ][0]["code"]
    detail = (await client.get(f"/api/v1/areas/{code.lower()}")).json()
    assert detail["code"] == code
    assert detail["conditions_of_use"]
    assert detail["lease_term_years"] > 0
    assert detail["required_documents"]
    assert detail["geometry"]["type"] == "MultiPolygon"


async def test_unknown_area_is_404(client):
    response = await client.get("/api/v1/areas/XXX-9999")
    assert response.status_code == 404


async def test_competitions_open_first(client):
    items = (await client.get("/api/v1/competitions")).json()
    assert items[0]["is_open"] is True
    assert any(not c["is_open"] for c in items)
    detail = (await client.get(f"/api/v1/competitions/{items[0]['number']}")).json()
    assert detail["lots"] and detail["required_documents"]


async def test_map_context_has_labels_and_mask(client):
    body = (await client.get("/api/v1/reference/map-context")).json()
    assert len(body["rayons"]["features"]) == 14
    assert body["mask"]["geometry"]["type"] in {"Polygon", "MultiPolygon"}
    names = {f["properties"]["name"] for f in body["rayon_labels"]["features"]}
    assert "Şuşa" in names and "Zəngilan" in names


async def test_financial_filters_on_fee_and_minimum_investment(client):
    everything = (await client.get("/api/v1/areas", params={"size": 200})).json()

    pricey = (await client.get("/api/v1/areas", params={"fee_min": 30, "size": 200})).json()
    assert 0 < pricey["total"] < everything["total"]
    assert all(float(i["annual_fee_azn_per_ha"]) >= 30 for i in pricey["items"])

    params = {"inv_min": 100_000, "inv_max": 300_000, "size": 200}
    modest = (await client.get("/api/v1/areas", params=params)).json()
    assert modest["total"] > 0
    for item in modest["items"]:
        assert 100_000 <= float(item["min_investment_azn"]) <= 300_000

    # The map uses the same filters, so it shows exactly the listed areas.
    geo = (await client.get("/api/v1/areas/geojson", params=params)).json()
    assert {f["properties"]["code"] for f in geo["features"]} == {
        i["code"] for i in modest["items"]
    }

    empty = (await client.get("/api/v1/areas", params={"fee_min": 50, "fee_max": 20})).json()
    assert empty["total"] == 0
    assert (await client.get("/api/v1/areas", params={"inv_min": -1})).status_code == 422


async def test_map_mask_keeps_the_coast_and_absheron_as_land(client):
    body = (await client.get("/api/v1/reference/map-context")).json()
    mask = shape(body["mask"]["geometry"])
    sea = shape(body["water"]["geometry"])
    land = {"Baku": (49.87, 40.41), "Mardakan": (50.15, 40.49), "Lankaran": (48.85, 38.75)}
    land["Nakhchivan"] = (45.41, 39.21)
    for name, xy in land.items():
        assert not mask.contains(Point(xy)), f"{name} is masked"
        assert not sea.contains(Point(xy)), f"{name} is under water"
    assert sea.contains(Point(50.2, 40.2))  # open sea east of Baku
    assert not mask.contains(Point(50.2, 40.2))
    assert mask.contains(Point(44.51, 40.18))  # Yerevan stays masked


async def test_search_tolerates_a_typo(client):
    typo = (await client.get("/api/v1/areas", params={"q": "Fizuli"})).json()
    exact = (await client.get("/api/v1/areas", params={"q": "Füzuli"})).json()
    assert exact["total"] > 0
    assert {i["code"] for i in exact["items"]} <= {i["code"] for i in typo["items"]}


async def test_compare_at_most_four_areas(client):
    items = (await client.get("/api/v1/areas", params={"size": 5})).json()["items"]
    codes = ",".join(i["code"] for i in items)
    body = (await client.get("/api/v1/areas/compare", params={"codes": codes})).json()
    assert len(body) == 4
    assert all("conditions_of_use" in b for b in body)


async def test_offline_context_tiles(client):
    # Zoom 9 tile over Ağdam (≈ 46.9 E, 40.0 N): roads and water as a vector tile.
    r = await client.get("/api/v1/tiles/context/9/322/193.pbf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/vnd.mapbox-vector-tile"
    assert len(r.content) > 100
    empty = await client.get("/api/v1/tiles/context/9/0/0.pbf")  # mid-Pacific
    assert empty.status_code == 200 and empty.content == b""

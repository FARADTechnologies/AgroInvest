"""One kind of portal user; only the administrator places listings; Azerbaijani and foreign
citizens identify themselves with FİN or a passport."""

from datetime import UTC, date, datetime, timedelta

from .conftest import login
from .test_admin_areas import _square


async def _admin(client):
    await login(client, "admin@agro-demo.test")
    return client


def _listing(lon: float, lat: float, **extra) -> dict:
    return {
        "geometry": _square(lon, lat, 0.006),
        "purpose": "ORCHARD",
        "title_az": "Zəngilan fındıq bağı üçün sahə",
        "description_az": "Araz vadisində suvarılan sahə, fındıq və qoz bağı üçün uyğundur.",
        "lease_term_years": 30,
        "annual_fee_azn_per_ha": 40,
        "min_investment_azn": 150000,
        "irrigation": "CANAL",
        "deadline_at": (datetime.now(UTC) + timedelta(days=20)).isoformat(),
        "demining_certified_on": (date.today() - timedelta(days=90)).isoformat(),
        **extra,
    }


async def _free_point(client) -> tuple[float, float]:
    body = (await client.get("/api/v1/areas", params={"q": "Zəngilan", "size": 1})).json()
    lon, lat = body["items"][0]["centroid"]
    return lon - 0.03, lat + 0.02


def _register(email: str, **extra) -> dict:
    return {
        "email": email,
        "password": "Parol123",
        "full_name": "Yeni İstifadəçi",
        "consent": True,
        **extra,
    }


async def test_every_new_account_is_a_portal_user(client):
    for i, role in enumerate((None, "INVESTOR", "ENTREPRENEUR")):
        body = _register(f"yeni-{i}@example.az", **({"role": role} if role else {}))
        r = await client.post("/api/v1/auth/register", json=body)
        assert r.status_code == 201, r.text
        assert r.json()["role"] == "INVESTOR"  # the old sahibkar choice is ignored
    r = await client.post("/api/v1/auth/register", json=_register("x@example.az", role="ADMIN"))
    assert r.status_code == 422  # staff accounts are never self-registered


async def test_only_the_administrator_places_listings(client):
    admin = await _admin(client)
    lon, lat = await _free_point(admin)
    r = await admin.post("/api/v1/listings", json=_listing(lon, lat))
    assert r.status_code == 201, r.text
    listing = r.json()
    assert listing["open"] and listing["area_code"].startswith("ZAN-")
    mine = (await admin.get("/api/v1/listings/mine")).json()
    assert any(item["area_code"] == listing["area_code"] for item in mine)

    area = (await admin.get(f"/api/v1/areas/{listing['area_code']}")).json()
    assert area["data_source"] == "LISTING"
    assert len(area["suitability"]) == 4  # scored like every other plot

    # The same plot cannot be listed twice.
    again = await admin.post("/api/v1/listings", json=_listing(lon + 0.001, lat + 0.001))
    assert again.status_code == 409

    # Portal users apply; they cannot place listings or see the listing desk.
    await login(client, "investor@agro-demo.test")
    r = await client.post("/api/v1/applications", json={"area_code": listing["area_code"]})
    assert r.status_code == 201, r.text
    assert (
        await client.post("/api/v1/listings", json=_listing(lon + 0.05, lat))
    ).status_code == 403
    assert (await client.get("/api/v1/listings/mine")).status_code == 403

    await login(client, "mutexessis@agro-demo.test")
    assert (
        await client.post("/api/v1/listings", json=_listing(lon + 0.07, lat))
    ).status_code == 403


async def test_a_listing_needs_a_future_deadline(client):
    admin = await _admin(client)
    lon, lat = await _free_point(admin)
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    r = await admin.post("/api/v1/listings", json=_listing(lon + 0.1, lat, deadline_at=past))
    assert r.status_code == 422


async def test_administrator_sees_applications_to_the_listings(client):
    admin = await _admin(client)
    rows = (await admin.get("/api/v1/listings/mine/applications")).json()
    assert rows, "the demo listings have applications"
    assert all(r["status"] != "DRAFT" for r in rows)
    assert {"investor", "investment_azn", "listing_number"} <= rows[0].keys()


def _person(**extra) -> dict:
    return {
        "type": "INDIVIDUAL",
        "full_name": "Test Şəxs",
        "phone": "+994 50 123 45 67",
        "email": "test@example.az",
        **extra,
    }


async def test_azerbaijani_citizen_needs_fin(client):
    r = await client.post("/api/v1/auth/register", json=_register("vetendas@example.az"))
    assert r.status_code == 201
    r = await client.put("/api/v1/me/entrepreneur", json=_person(citizenship="AZ"))
    assert r.status_code == 422
    r = await client.put("/api/v1/me/entrepreneur", json=_person(citizenship="AZ", fin="5abc123"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["citizenship"] == "AZ" and body["fin"] == "5ABC123" and body["passport_no"] is None


async def test_foreign_citizen_uses_a_passport(client):
    r = await client.post("/api/v1/auth/register", json=_register("xarici@example.az"))
    assert r.status_code == 201
    no_country = _person(citizenship="FOREIGN", passport_no="C01X00T47")
    assert (await client.put("/api/v1/me/entrepreneur", json=no_country)).status_code == 422
    r = await client.put(
        "/api/v1/me/entrepreneur",
        json=_person(
            citizenship="FOREIGN",
            passport_no="c01x 00t47",
            citizenship_country="Türkiyə",
            fin="1234567",  # dropped: a foreign citizen has no FİN
        ),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["citizenship"] == "FOREIGN"
    assert body["passport_no"] == "C01X00T47" and body["citizenship_country"] == "Türkiyə"
    assert body["fin"] is None

    # The EKTIS farmer registry is keyed by FİN or VÖEN, so it is not offered.
    check = (await client.post("/api/v1/me/entrepreneur/ektis-check")).json()
    assert check["available"] is False and check["registered"] is False


async def test_administrator_withdraws_a_listing():
    from .test_application_flow import _fill_and_submit, _new_client, _register_company

    admin = await _new_client()
    await login(admin, "admin@agro-demo.test")
    lon, lat = await _free_point(admin)
    lon, lat = lon + 0.13, lat - 0.01
    listing = (await admin.post("/api/v1/listings", json=_listing(lon, lat))).json()
    code, comp_id = listing["area_code"], listing["competition_id"]

    investor = await _new_client()
    await _register_company(investor)
    app = await _fill_and_submit(investor, code)

    url = f"/api/v1/listings/{comp_id}/withdraw"
    assert (await investor.post(url, json={"reason": "Sahə satışdan çıxarılır"})).status_code == 403
    assert (await admin.post(url, json={"reason": "yox"})).status_code == 422

    r = await admin.post(url, json={"reason": "Sahə satışdan çıxarılır"})
    assert r.status_code == 200, r.text
    assert r.json() == {"number": listing["number"], "area_codes": [code], "declined": 1}

    # Off the portal everywhere: plot page, catalogue, competitions, the listing desk.
    assert (await investor.get(f"/api/v1/areas/{code}")).status_code == 404
    catalogue = (await investor.get("/api/v1/areas", params={"q": code})).json()
    assert all(item["code"] != code for item in catalogue["items"])
    assert (await investor.get(f"/api/v1/competitions/{listing['number']}")).status_code == 404
    desk = (await admin.get("/api/v1/listings/mine")).json()
    assert all(item["area_code"] != code for item in desk)

    # The applicant is declined with the reason and told so.
    mine = (await investor.get(f"/api/v1/applications/{app['id']}")).json()
    assert mine["status"] == "DECIDED" and mine["outcome"] == "REJECTED"
    assert "Sahə satışdan çıxarılır" in mine["decision_reason"]
    notes = (await investor.get("/api/v1/notifications")).json()["items"]
    assert any(n["title_az"] == "Elan geri götürüldü" for n in notes)

    assert (await admin.post(url, json={"reason": "Sahə satışdan çıxarılır"})).status_code == 409
    # The ground is free again for a new listing.
    again = await admin.post("/api/v1/listings", json=_listing(lon, lat))
    assert again.status_code == 201, again.text

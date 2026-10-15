"""Sahibkars place listings, investors state preferences and apply; neither can do the other's part."""

from datetime import UTC, date, datetime, timedelta

from .conftest import login
from .test_admin_areas import _square


async def _sahibkar(client):
    await login(client, "sahibkar@agro-demo.test")
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


async def test_registration_offers_investor_and_sahibkar(client):
    for role in ("INVESTOR", "ENTREPRENEUR"):
        r = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"yeni-{role.lower()}@example.az",
                "password": "Parol123",
                "full_name": "Yeni İstifadəçi",
                "consent": True,
                "role": role,
            },
        )
        assert r.status_code == 201, r.text
        assert r.json()["role"] == role
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": "x@example.az", "password": "Parol123", "full_name": "Xxx", "consent": True, "role": "ADMIN"},
    )
    assert r.status_code == 422  # staff accounts are never self-registered


async def test_sahibkar_places_a_listing_investors_can_apply_to(client):
    sahibkar = await _sahibkar(client)
    lon, lat = await _free_point(sahibkar)
    r = await sahibkar.post("/api/v1/listings", json=_listing(lon, lat))
    assert r.status_code == 201, r.text
    listing = r.json()
    assert listing["open"] and listing["area_code"].startswith("ZAN-")
    assert any(item["area_code"] == listing["area_code"] for item in (await sahibkar.get("/api/v1/listings/mine")).json())

    area = (await sahibkar.get(f"/api/v1/areas/{listing['area_code']}")).json()
    assert area["data_source"] == "LISTING"
    assert len(area["suitability"]) == 4  # scored like every other plot

    # The same plot cannot be listed twice.
    again = await sahibkar.post("/api/v1/listings", json=_listing(lon + 0.001, lat + 0.001))
    assert again.status_code == 409

    # A sahibkar does not apply; an investor does.
    assert (await sahibkar.post("/api/v1/applications", json={"area_code": listing["area_code"]})).status_code == 403
    await login(client, "investor@agro-demo.test")
    r = await client.post("/api/v1/applications", json={"area_code": listing["area_code"]})
    assert r.status_code == 201, r.text
    assert (await client.post("/api/v1/listings", json=_listing(lon + 0.05, lat))).status_code == 403


async def test_a_listing_needs_a_future_deadline_and_a_profile(client):
    sahibkar = await _sahibkar(client)
    lon, lat = await _free_point(sahibkar)
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    r = await sahibkar.post("/api/v1/listings", json=_listing(lon + 0.1, lat, deadline_at=past))
    assert r.status_code == 422

    r = await client.post(
        "/api/v1/auth/register",
        json={"email": "profilsiz@example.az", "password": "Parol123", "full_name": "Profilsiz Sahibkar",
              "consent": True, "role": "ENTREPRENEUR"},
    )
    assert r.status_code == 201
    r = await client.post("/api/v1/listings", json=_listing(lon + 0.12, lat))
    assert r.status_code == 422 and r.json()["title"] == "profile_required"


async def test_sahibkar_sees_applications_to_their_listings(client):
    sahibkar = await _sahibkar(client)
    rows = (await sahibkar.get("/api/v1/listings/mine/applications")).json()
    assert rows, "the demo listings have applications"
    assert all(r["status"] != "DRAFT" for r in rows)
    assert {"investor", "investment_azn", "listing_number"} <= rows[0].keys()


async def test_investor_preferences_are_kept_and_sahibkar_has_none(client):
    sahibkar = await _sahibkar(client)
    profile = (await sahibkar.get("/api/v1/me/entrepreneur")).json()
    body = {k: profile[k] for k in ("type", "voen", "fin", "full_name", "company_name", "legal_form", "phone", "email")}
    r = await sahibkar.put("/api/v1/me/entrepreneur", json={**body, "budget_azn": 1000, "interests": ["CROP"]})
    assert r.status_code == 200 and r.json()["budget_azn"] is None and r.json()["interests"] is None

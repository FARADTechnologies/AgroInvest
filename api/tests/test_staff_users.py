"""The administrator creates staff accounts and decides what each may do."""

from .conftest import login


def _staff(email: str, *permissions: str, **extra) -> dict:
    return {
        "email": email,
        "full_name": "Aysel Hüseynova",
        "position": "Sənəd yoxlayan mütəxəssis",
        "password": "Isci2026x",
        "permissions": list(permissions),
        **extra,
    }


async def test_only_the_administrator_manages_staff(client):
    await login(client, "mutexessis@agro-demo.test")
    assert (await client.get("/api/v1/admin/users")).status_code == 403
    assert (await client.post("/api/v1/admin/users", json=_staff("x1@agro.az"))).status_code == 403
    await login(client, "investor@agro-demo.test")
    assert (await client.get("/api/v1/admin/users")).status_code == 403

    await login(client, "admin@agro-demo.test")
    catalogue = (await client.get("/api/v1/admin/users/permissions")).json()
    assert {"APPLICATIONS_VIEW", "COMPETITIONS_APPROVE", "LISTINGS_MANAGE"} <= {
        p["code"] for p in catalogue
    }
    assert all(p["label"] for p in catalogue)
    staff = (await client.get("/api/v1/admin/users")).json()
    assert {"admin@agro-demo.test", "mutexessis@agro-demo.test"} <= {s["email"] for s in staff}
    assert all(s["role"] != "INVESTOR" for s in staff)


async def test_staff_can_do_exactly_what_was_granted(client):
    await login(client, "admin@agro-demo.test")
    r = await client.post("/api/v1/admin/users", json=_staff("yoxlayici@agro.az", "STATS_VIEW"))
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["role"] == "STAFF" and created["permissions"] == ["STATS_VIEW"]
    assert created["position"] == "Sənəd yoxlayan mütəxəssis"
    sid = created["id"]

    await login(client, "yoxlayici@agro.az", "Isci2026x")
    me = (await client.get("/api/v1/auth/session")).json()["user"]
    assert me["role"] == "STAFF" and me["permissions"] == ["STATS_VIEW"]
    assert (await client.get("/api/v1/admin/stats")).status_code == 200
    assert (await client.get("/api/v1/admin/applications")).status_code == 403
    assert (await client.get("/api/v1/admin/areas")).status_code == 200  # any staff may look

    await login(client, "admin@agro-demo.test")
    r = await client.patch(
        f"/api/v1/admin/users/{sid}",
        json={"permissions": ["STATS_VIEW", "APPLICATIONS_VIEW", "APPLICATIONS_DECIDE"]},
    )
    assert r.status_code == 200, r.text

    await login(client, "yoxlayici@agro.az", "Isci2026x")
    apps = (await client.get("/api/v1/admin/applications")).json()["items"]
    assert apps
    detail = (await client.get(f"/api/v1/admin/applications/{apps[0]['id']}")).json()
    assert detail["number"] == apps[0]["number"]
    # Not granted: placing listings and approving competitions.
    assert (await client.get("/api/v1/listings/mine")).status_code == 403
    assert (await client.get("/api/v1/admin/audit")).status_code == 403


async def test_switched_off_staff_cannot_sign_in(client):
    await login(client, "admin@agro-demo.test")
    sid = (await client.post("/api/v1/admin/users", json=_staff("kecmis@agro.az"))).json()["id"]
    r = await client.patch(f"/api/v1/admin/users/{sid}", json={"is_active": False})
    assert r.status_code == 200 and r.json()["is_active"] is False
    r = await client.post(
        "/api/v1/auth/login", json={"email": "kecmis@agro.az", "password": "Isci2026x"}
    )
    assert r.status_code == 401

    r = await client.post(f"/api/v1/admin/users/{sid}/password", json={"password": "Yeni2026y"})
    assert r.status_code == 204
    await client.patch(f"/api/v1/admin/users/{sid}", json={"is_active": True})
    r = await client.post(
        "/api/v1/auth/login", json={"email": "kecmis@agro.az", "password": "Yeni2026y"}
    )
    assert r.status_code == 200


async def test_the_administrator_keeps_every_right(client):
    await login(client, "admin@agro-demo.test")
    me = (await client.get("/api/v1/auth/session")).json()["user"]
    assert "LISTINGS_MANAGE" in me["permissions"] and "AUDIT_VIEW" in me["permissions"]
    admin = next(
        s for s in (await client.get("/api/v1/admin/users")).json() if s["role"] == "ADMIN"
    )
    r = await client.patch(f"/api/v1/admin/users/{admin['id']}", json={"permissions": []})
    assert r.status_code == 403
    r = await client.post("/api/v1/admin/users", json=_staff("admin@agro-demo.test"))
    assert r.status_code == 409

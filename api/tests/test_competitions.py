"""Maker-checker: a specialist drafts, a different supervisor publishes; the administrator
may publish alone."""

from datetime import UTC, datetime, timedelta

from httpx import ASGITransport, AsyncClient

from tests.conftest import login


async def _client() -> AsyncClient:
    from app.main import app

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _available_area_ids(client: AsyncClient, n: int = 2) -> list[str]:
    """Cleared plots that are not offered in any competition yet."""
    body = (await client.get("/api/v1/areas", params={"size": 200})).json()
    free = [
        a["id"]
        for a in body["items"]
        if a["competition"] is None
        and a["demining_status"] == "CLEARED"
        and a["status"] == "AVAILABLE"
    ]
    assert len(free) >= n
    return free[:n]


def _payload(area_ids: list[str]) -> dict:
    now = datetime.now(UTC)
    return {
        "title_az": "Füzuli rayonunda istixana təsərrüfatları",
        "description_az": "İstixana və emal üçün sahələr.",
        "conditions_az": "Fiziki və hüquqi şəxslər iştirak edə bilər.",
        "opens_at": (now + timedelta(hours=1)).isoformat(),
        "deadline_at": (now + timedelta(days=30)).isoformat(),
        "lots": [{"farm_area_id": a, "min_investment_azn": "100000"} for a in area_ids],
        "required_documents": [{"code": "BUSINESS_PLAN", "mandatory": True}],
    }


async def test_maker_checker_flow():
    specialist, supervisor = await _client(), await _client()
    async with specialist, supervisor:
        await login(specialist, "mutexessis@agro-demo.test")
        await login(supervisor, "rehber@agro-demo.test")
        ids = await _available_area_ids(specialist)

        created = await specialist.post("/api/v1/admin/competitions", json=_payload(ids))
        assert created.status_code == 201, created.text
        comp = created.json()
        assert comp["status"] == "DRAFT" and comp["number"].startswith("MS-")
        cid = comp["id"]

        # Supervisors cannot draft; specialists cannot approve.
        assert (
            await supervisor.post("/api/v1/admin/competitions", json=_payload(ids))
        ).status_code == 403
        assert (
            await specialist.post(f"/api/v1/admin/competitions/{cid}/approve", json={})
        ).status_code == 403

        assert (
            await supervisor.post(f"/api/v1/admin/competitions/{cid}/approve", json={})
        ).status_code == 409
        submitted = (await specialist.post(f"/api/v1/admin/competitions/{cid}/submit")).json()
        assert submitted["status"] == "PENDING_APPROVAL"

        back = await supervisor.post(
            f"/api/v1/admin/competitions/{cid}/return", json={"comment": ""}
        )
        assert back.status_code == 422  # a reason is required
        back = await supervisor.post(
            f"/api/v1/admin/competitions/{cid}/return",
            json={"comment": "Minimum investisiyanı artırın"},
        )
        assert back.json()["status"] == "DRAFT"
        assert back.json()["review_comment"] == "Minimum investisiyanı artırın"

        await specialist.post(f"/api/v1/admin/competitions/{cid}/submit")
        approved = await supervisor.post(
            f"/api/v1/admin/competitions/{cid}/approve", json={"comment": "Təsdiq edildi"}
        )
        assert approved.status_code == 200, approved.text
        body = approved.json()
        assert body["status"] == "PUBLISHED" and body["approved_by_name"] == "Tural Abbasov"

        # The plots are now in a competition and cannot be offered twice.
        again = await specialist.post("/api/v1/admin/competitions", json=_payload(ids[:1]))
        assert again.status_code == 409


async def test_administrator_may_approve_own_competition():
    """The administrator runs the portal alone, so the four-eyes rule between staff does not
    stop them from publishing a competition they drafted."""
    admin = await _client()
    async with admin:
        await login(admin, "admin@agro-demo.test")
        ids = await _available_area_ids(admin, 1)
        cid = (await admin.post("/api/v1/admin/competitions", json=_payload(ids))).json()["id"]
        await admin.post(f"/api/v1/admin/competitions/{cid}/submit")
        r = await admin.post(f"/api/v1/admin/competitions/{cid}/approve", json={})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "PUBLISHED"


async def test_mined_area_cannot_be_offered(specialist):
    body = (await specialist.get("/api/v1/areas", params={"size": 200})).json()
    mined = next(a["id"] for a in body["items"] if a["demining_status"] != "CLEARED")
    r = await specialist.post("/api/v1/admin/competitions", json=_payload([mined]))
    assert r.status_code == 422
    assert r.json()["title"] == "not_demined"


async def test_lot_result_declines_the_other_applicants(specialist):
    comps = (await specialist.get("/api/v1/admin/competitions")).json()["items"]
    closed = next(c for c in comps if c["status"] == "CLOSED")
    # Lot 2 of the closed seed competition has an application under review.
    lot = next(lot for lot in closed["lots"] if lot["applications"] and not lot["winner_number"])
    apps = (await specialist.get("/api/v1/admin/applications", params={"q": lot["code"]})).json()[
        "items"
    ]
    candidate = next(a for a in apps if a["status"] == "UNDER_REVIEW")
    r = await specialist.post(
        f"/api/v1/admin/competitions/{closed['id']}/results",
        json={
            "farm_area_id": lot["farm_area_id"],
            "winner_application_id": candidate["id"],
            "reason_winner": "Ən yüksək bal",
            "reason_others": "Sahə üzrə qalib müəyyən edildi",
        },
    )
    assert r.status_code == 200, r.text
    updated = next(x for x in r.json()["lots"] if x["farm_area_id"] == lot["farm_area_id"])
    assert updated["winner_number"] == candidate["number"]

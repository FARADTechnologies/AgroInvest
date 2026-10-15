"""Security rules: IP limits, audited identifier reveal, role checks, no cross-user access."""

import pytest
from sqlalchemy import func, select

from app.core.ratelimit import SlidingWindow
from app.db.session import SessionFactory
from app.modules.audit.models import AuditLog
from app.modules.identity import router as identity_router

from .conftest import login


def test_sliding_window():
    window = SlidingWindow(limit=2, window_s=60)
    assert window.retry_after("ip") is None
    window.add("ip")
    window.add("ip")
    assert 1 <= window.retry_after("ip") <= 61
    assert window.retry_after("other-ip") is None


async def test_failed_logins_from_one_address_are_throttled(client, monkeypatch):
    monkeypatch.setattr(identity_router, "LOGIN_FAILURES", SlidingWindow(3, 600))
    for i in range(3):
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": f"nobody{i}@agro-demo.test", "password": "yanlis-123"},
        )
        assert r.status_code == 401
    blocked = await client.post(
        "/api/v1/auth/login", json={"email": "mutexessis@agro-demo.test", "password": "Demo2026!"}
    )
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
    assert blocked.json()["title"] == "too_many_requests"


async def test_sign_ups_from_one_address_are_limited(client, monkeypatch):
    monkeypatch.setattr(identity_router, "REGISTRATIONS", SlidingWindow(1, 3600))
    body = {"password": "Parol123", "full_name": "Limit Test", "consent": True}
    first = await client.post(
        "/api/v1/auth/register", json={**body, "email": "limit-1@agro-demo.test"}
    )
    assert first.status_code == 201
    second = await client.post(
        "/api/v1/auth/register", json={**body, "email": "limit-2@agro-demo.test"}
    )
    assert second.status_code == 429


async def _an_application_id(staff) -> str:
    listed = (await staff.get("/api/v1/admin/applications")).json()
    return next(i["id"] for i in listed["items"] if i["applicant_identifier"])


async def test_full_identifier_needs_a_reason_and_is_audited(specialist):
    app_id = await _an_application_id(specialist)
    detail = (await specialist.get(f"/api/v1/admin/applications/{app_id}")).json()
    assert "•" in detail["applicant"]["identifier"]

    short = await specialist.post(
        f"/api/v1/admin/applications/{app_id}/identifier", json={"reason": "x"}
    )
    assert short.status_code == 422

    async with SessionFactory() as session:
        before = await session.scalar(
            select(func.count()).where(AuditLog.action == "application.reveal_identifier")
        )
    shown = await specialist.post(
        f"/api/v1/admin/applications/{app_id}/identifier",
        json={"reason": "VÖEN şəhadətnaməsi ilə tutuşdurma"},
    )
    assert shown.status_code == 200
    value = shown.json()["identifier"]
    assert "•" not in value and len(value) in (7, 10)
    async with SessionFactory() as session:
        after = await session.scalar(
            select(func.count()).where(AuditLog.action == "application.reveal_identifier")
        )
    assert after == before + 1


async def test_supervisors_and_applicants_cannot_reveal(client):
    await login(client, "mutexessis@agro-demo.test")
    app_id = await _an_application_id(client)
    for email in ("rehber@agro-demo.test", "sahibkar@agro-demo.test"):
        await login(client, email)
        r = await client.post(
            f"/api/v1/admin/applications/{app_id}/identifier", json={"reason": "Yoxlama üçün"}
        )
        assert r.status_code == 403


STAFF_PAGES = [
    "/api/v1/admin/applications",
    "/api/v1/admin/competitions",
    "/api/v1/admin/areas",
    "/api/v1/admin/stats",
    "/api/v1/admin/integration/log",
    "/api/v1/admin/reports/applications.xlsx",
]


@pytest.mark.parametrize("path", STAFF_PAGES)
async def test_staff_endpoints_need_a_staff_role(client, path):
    await client.post("/api/v1/auth/logout")
    assert (await client.get(path)).status_code == 401
    await login(client, "sahibkar@agro-demo.test")
    assert (await client.get(path)).status_code == 403


async def test_applicants_cannot_download_other_peoples_documents(client):
    await login(client, "mutexessis@agro-demo.test")
    listed = (await client.get("/api/v1/admin/applications", params={"q": "Araz"})).json()
    other = (await client.get(f"/api/v1/admin/applications/{listed['items'][0]['id']}")).json()
    document = other["documents"][0]
    await login(client, "sahibkar@agro-demo.test")
    r = await client.get(f"/api/v1/applications/{other['id']}/documents/{document['id']}")
    assert r.status_code == 404  # existence is not revealed either

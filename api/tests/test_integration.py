"""EKTIS integration: outbox in the decision transaction, retries, log, farmer lookup.

A fake client stands in for EKTIS, so these tests need no running mock.
"""

import pytest

from app.main import app
from app.modules.integration.client import EktisResult, get_ektis_client

from .conftest import login


class FakeEktis:
    def __init__(self) -> None:
        self.down = False
        self.sent: list[dict] = []

    def _result(self, method: str, path: str, request_id: str, status: int | None, data=None):
        error = None if status and status < 400 else f"HTTP {status}" if status else "unreachable"
        return EktisResult(method, path, status, 3, request_id, data, error)

    async def lookup_farmer(self, *, fin, voen, request_id):
        if self.down:
            return self._result("GET", "/farmers", request_id, None)
        if voen == "1905832207":
            return self._result(
                "GET",
                "/farmers",
                request_id,
                200,
                {
                    "farmerId": "EKTIS-F-104512",
                    "name": "Yaşıl Vadi Aqro MMC",
                    "activities": ["CROP"],
                },
            )
        return self._result("GET", "/farmers", request_id, 404)

    async def send_decision(self, payload, request_id):
        if self.down:
            return self._result("POST", "/land-use-decisions", request_id, 503)
        self.sent.append(payload)
        reference = f"EKTIS-LUD-2026-{len(self.sent):06d}"
        return self._result(
            "POST", "/land-use-decisions", request_id, 201, {"ektisReference": reference}
        )

    async def get_fault(self, request_id):
        return self._result(
            "GET", "/_mock/faults", request_id, 200, {"mode": "DOWN" if self.down else "NONE"}
        )

    async def set_fault(self, mode, request_id):
        self.down = mode == "DOWN"
        return await self.get_fault(request_id)


@pytest.fixture
def ektis():
    fake = FakeEktis()
    app.dependency_overrides[get_ektis_client] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_ektis_client, None)


async def _decide_a_winner(staff) -> dict:
    """Decides 'Qalib' on a reviewed application whose plot has no winner yet."""
    listed = (
        await staff.get("/api/v1/admin/applications", params={"status": "UNDER_REVIEW"})
    ).json()
    for item in listed["items"]:
        r = await staff.post(
            f"/api/v1/admin/applications/{item['id']}/transitions",
            json={
                "to": "DECIDED",
                "outcome": "WON",
                "reason": "Ən yüksək qiymətləndirilmiş müraciət",
            },
        )
        if r.status_code == 200:
            return r.json()
    pytest.fail("no reviewed application could be decided")


async def test_a_winning_decision_is_queued_and_survives_an_outage(specialist, ektis):
    decided = await _decide_a_winner(specialist)
    queued = (
        await specialist.get(
            "/api/v1/admin/integration/outbox", params={"application_id": decided["id"]}
        )
    ).json()
    assert len(queued) == 1 and queued[0]["status"] == "PENDING"
    message_id = queued[0]["id"]

    # EKTIS is down: the attempt fails, is logged and stays queued for an automatic retry.
    ektis.down = True
    failed = (await specialist.post(f"/api/v1/admin/integration/outbox/{message_id}/retry")).json()
    assert failed["status"] == "PENDING" and failed["attempts"] == 1 and failed["last_error"]

    # EKTIS is back: switching the simulated fault off delivers what waited.
    status = (
        await specialist.post("/api/v1/admin/integration/fault", json={"mode": "NONE"})
    ).json()
    assert status["reachable"] is True and status["fault"] == "NONE"
    delivered = (
        await specialist.get(
            "/api/v1/admin/integration/outbox", params={"application_id": decided["id"]}
        )
    ).json()[0]
    assert delivered["status"] == "SENT" and delivered["ektis_reference"].startswith("EKTIS-LUD-")

    payload = next(p for p in ektis.sent if p["decisionId"] == decided["id"])
    assert (
        payload["outcome"] == "WON" and payload["parcel"]["code"] and payload["applicant"]["name"]
    )

    log = (await specialist.get("/api/v1/admin/integration/log")).json()
    attempts = [
        e
        for e in log
        if e["operation"] == "decision.send" and decided["number"] in (e["summary"] or "")
    ]
    assert {e["ok"] for e in attempts} == {True, False}
    assert all(e["request_id"] for e in attempts)


async def test_a_declined_application_sends_nothing(specialist, ektis):
    listed = (
        await specialist.get("/api/v1/admin/applications", params={"status": "UNDER_REVIEW"})
    ).json()
    if not listed["items"]:
        pytest.skip("no reviewed application left")
    target = listed["items"][0]
    r = await specialist.post(
        f"/api/v1/admin/applications/{target['id']}/transitions",
        json={
            "to": "DECIDED",
            "outcome": "REJECTED",
            "reason": "Biznes plan tələblərə cavab vermir",
        },
    )
    assert r.status_code == 200, r.text
    queued = (
        await specialist.get(
            "/api/v1/admin/integration/outbox", params={"application_id": target["id"]}
        )
    ).json()
    assert queued == []


async def test_farmer_lookup_checks_only_the_applicants_own_identifier(investor, ektis):
    found = (await investor.post("/api/v1/me/entrepreneur/ektis-check")).json()
    assert found["registered"] is True and found["farmer_id"] == "EKTIS-F-104512"
    profile = (await investor.get("/api/v1/me/entrepreneur")).json()
    assert profile["ektis_farmer_id"] == "EKTIS-F-104512"

    ektis.down = True
    unavailable = (await investor.post("/api/v1/me/entrepreneur/ektis-check")).json()
    assert unavailable["available"] is False

    await login(investor, "mutexessis@agro-demo.test")
    log = (await investor.get("/api/v1/admin/integration/log")).json()
    lookups = [e for e in log if e["operation"] == "farmer.lookup"]
    assert lookups and all("1905832207" not in (e["summary"] or "") for e in lookups)  # masked


async def test_only_specialists_control_the_simulated_fault(client, ektis):
    await login(client, "investor@agro-demo.test")
    assert (
        await client.post("/api/v1/admin/integration/fault", json={"mode": "DOWN"})
    ).status_code == 403
    await login(client, "rehber@agro-demo.test")
    assert (await client.get("/api/v1/admin/integration/log")).status_code == 200
    assert (
        await client.post("/api/v1/admin/integration/fault", json={"mode": "DOWN"})
    ).status_code == 403


def _signed(body: bytes, secret: str, timestamp: int | None = None) -> dict[str, str]:
    import hashlib
    import hmac
    import time

    ts = str(timestamp if timestamp is not None else int(time.time()))
    digest = hmac.new(secret.encode(), ts.encode() + b"." + body, hashlib.sha256).hexdigest()
    return {
        "X-Timestamp": ts,
        "X-Signature": f"sha256={digest}",
        "Content-Type": "application/json",
    }


async def test_ektis_confirms_a_decision_with_a_signed_callback(client):
    import json
    import uuid

    from app.core.config import get_settings
    from app.db.session import SessionFactory
    from app.modules.integration.models import IntegrationOutbox

    decision_id = str(uuid.uuid4())
    async with SessionFactory() as session:
        message = IntegrationOutbox(
            kind="LAND_USE_DECISION",
            payload={"decisionId": decision_id, "applicationNumber": "QIM-2026-999999"},
        )
        session.add(message)
        await session.commit()
        message_id = message.id

    event = {
        "eventId": str(uuid.uuid4()),
        "type": "LAND_USE_DECISION_REGISTERED",
        "decisionId": decision_id,
        "applicationNumber": "QIM-2026-999999",
        "landUseRightId": "EKTIS-LUR-2026-000042",
    }
    body = json.dumps(event).encode()
    secret = get_settings().ektis_hmac_secret
    headers = {**_signed(body, secret), "Idempotency-Key": event["eventId"]}
    url = "/api/v1/integration/ektis/events"

    first = await client.post(url, content=body, headers=headers)
    assert first.status_code == 200 and first.json()["status"] == "accepted"
    again = await client.post(url, content=body, headers=headers)
    assert again.json()["status"] == "duplicate"  # the same event is applied once

    async with SessionFactory() as session:
        confirmed = await session.get(IntegrationOutbox, message_id)
        assert confirmed.confirmed_at is not None
        assert confirmed.land_use_right_id == "EKTIS-LUR-2026-000042"

    forged = await client.post(
        url, content=body, headers={**headers, "X-Signature": "sha256=" + "0" * 64}
    )
    assert forged.status_code == 401
    stale = await client.post(
        url, content=body, headers=_signed(body, secret, timestamp=1_600_000_000)
    )
    assert stale.status_code == 401  # a replay of an old, once valid message

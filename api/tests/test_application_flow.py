"""The core demo path end to end: apply, review, request information, answer, decide."""

import uuid

from httpx import ASGITransport, AsyncClient

from tests.conftest import login

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
EXE_AS_PDF = b"MZ\x90\x00\x03\x00\x00\x00 this is not a pdf"


async def _new_client():
    from app.main import app

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _register_company(client: AsyncClient) -> None:
    email = f"flow-{uuid.uuid4().hex[:8]}@agro-demo.test"
    r = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Parol123",
            "full_name": "Aysel Həsənova",
            "consent": True,
        },
    )
    assert r.status_code == 201, r.text
    r = await client.put(
        "/api/v1/me/entrepreneur",
        json={
            "type": "COMPANY",
            "voen": "1700123456",
            "full_name": "Aysel Həsənova",
            "company_name": "Şuşa Bağları MMC",
            "phone": "+994 50 222 33 44",
            "email": email,
            "is_local": True,
        },
    )
    assert r.status_code == 200, r.text


async def _open_area_code(client: AsyncClient) -> str:
    body = (await client.get("/api/v1/areas", params={"open_only": "true", "size": 50})).json()
    return body["items"][-1]["code"]


async def _fill_and_submit(client: AsyncClient, area_code: str) -> dict:
    app = (await client.post("/api/v1/applications", json={"area_code": area_code})).json()
    app_id = app["id"]
    assert app["status"] == "DRAFT"

    early = await client.post(f"/api/v1/applications/{app_id}/submit")
    assert early.status_code == 422  # incomplete

    r = await client.patch(
        f"/api/v1/applications/{app_id}",
        json={
            "project_title": "İntensiv alma bağı",
            "business_plan": {
                "investment_azn": "850000",
                "own_funds_pct": "40",
                "jobs_planned": 25,
                "jobs_local": 18,
                "implementation_months": 18,
                "experience_years": 6,
                "summary": "Damcı suvarma ilə 30 ha intensiv alma bağı və soyuducu anbar.",
            },
        },
    )
    assert r.status_code == 200, r.text

    for req in r.json()["required_documents"]:
        if req["mandatory"]:
            up = await client.post(
                f"/api/v1/applications/{app_id}/documents",
                data={"doc_type_code": req["code"]},
                files={"file": (f"{req['code'].lower()}.pdf", PDF, "application/pdf")},
            )
            assert up.status_code == 201, up.text

    submitted = await client.post(f"/api/v1/applications/{app_id}/submit")
    assert submitted.status_code == 200, submitted.text
    return submitted.json()


async def test_full_review_cycle():
    applicant = await _new_client()
    staff = await _new_client()
    async with applicant, staff:
        await _register_company(applicant)
        area_code = await _open_area_code(applicant)
        app = await _fill_and_submit(applicant, area_code)
        app_id = app["id"]
        assert app["status"] == "RECEIVED"
        assert app["number"].startswith("QIM-")
        assert app["applicant"]["identifier"] == "1700123456"  # the owner sees it in full

        notes = (await applicant.get("/api/v1/notifications")).json()
        assert notes["unread"] >= 1 and notes["items"][0]["title_az"] == "Müraciətiniz qəbul edildi"

        # Staff see a masked identifier and only the transitions the state machine allows.
        await login(staff, "mutexessis@agro-demo.test")
        listed = (await staff.get("/api/v1/admin/applications", params={"q": app["number"]})).json()
        assert listed["total"] == 1
        assert listed["items"][0]["applicant_identifier"] == "17••••••56"
        detail = (await staff.get(f"/api/v1/admin/applications/{app_id}")).json()
        assert detail["applicant"]["identifier_masked"] is True
        assert detail["allowed_transitions"] == ["UNDER_REVIEW"]

        async def move(body: dict, expect: int = 200) -> dict:
            r = await staff.post(f"/api/v1/admin/applications/{app_id}/transitions", json=body)
            assert r.status_code == expect, r.text
            return r.json()

        await move(
            {"to": "DECIDED", "outcome": "WON", "reason": "x"}, expect=409
        )  # must review first
        reviewed = await move({"to": "UNDER_REVIEW"})
        assert reviewed["status"] == "UNDER_REVIEW"
        await move({"to": "INFO_REQUESTED"}, expect=422)  # reason required
        asked = await move(
            {
                "to": "INFO_REQUESTED",
                "reason": "Suvarma planını və təcrübəni təsdiq edən sənədi əlavə edin.",
                "requested_doc_types": ["EXPERIENCE"],
                "expected_version": reviewed["version"],
            }
        )
        assert asked["status"] == "INFO_REQUESTED"

        # The applicant must attach the requested document before answering.
        early = await applicant.post(
            f"/api/v1/applications/{app_id}/info-response", json={"response_text": "Əlavə edildi"}
        )
        assert early.status_code == 422
        up = await applicant.post(
            f"/api/v1/applications/{app_id}/documents",
            data={"doc_type_code": "EXPERIENCE"},
            files={"file": ("tecrube.pdf", PDF, "application/pdf")},
        )
        assert up.status_code == 201, up.text
        answered = await applicant.post(
            f"/api/v1/applications/{app_id}/info-response",
            json={
                "response_text": "Damcı suvarma layihəsi və 6 illik təcrübə arayışı əlavə edildi."
            },
        )
        assert answered.status_code == 200, answered.text
        assert answered.json()["status"] == "UNDER_REVIEW"

        await move(
            {"to": "DECIDED", "reason": "Ən yüksək investisiya"}, expect=422
        )  # outcome required
        decided = await move(
            {"to": "DECIDED", "outcome": "WON", "reason": "Ən yüksək investisiya və iş yeri."}
        )
        assert decided["status"] == "DECIDED" and decided["outcome"] == "WON"
        await move({"to": "UNDER_REVIEW"}, expect=409)  # decisions are final

        history = [h["to_status"] for h in decided["history"]]
        assert history == [
            "DRAFT",
            "RECEIVED",
            "UNDER_REVIEW",
            "INFO_REQUESTED",
            "UNDER_REVIEW",
            "DECIDED",
        ]

        mine = (await applicant.get(f"/api/v1/applications/{app_id}")).json()
        assert mine["outcome"] == "WON"
        assert "Mütəxəssis" in mine["history"][-1]["actor_label"]


async def test_other_people_cannot_see_an_application(entrepreneur):
    stranger = await _new_client()
    async with stranger:
        await _register_company(stranger)
        app = await _fill_and_submit(stranger, await _open_area_code(stranger))
        # The demo entrepreneur gets 404, not 403: existence is not revealed.
        r = await entrepreneur.get(f"/api/v1/applications/{app['id']}")
        assert r.status_code == 404
        r = await entrepreneur.get(f"/api/v1/admin/applications/{app['id']}")
        assert r.status_code == 403


async def test_renamed_executable_is_rejected():
    client = await _new_client()
    async with client:
        await _register_company(client)
        app = (
            await client.post(
                "/api/v1/applications", json={"area_code": await _open_area_code(client)}
            )
        ).json()
        r = await client.post(
            f"/api/v1/applications/{app['id']}/documents",
            data={"doc_type_code": "BUSINESS_PLAN"},
            files={"file": ("biznes-plan.pdf", EXE_AS_PDF, "application/pdf")},
        )
        assert r.status_code == 422
        assert r.json()["title"] == "file_type"


async def test_one_application_per_area():
    client = await _new_client()
    async with client:
        await _register_company(client)
        code = await _open_area_code(client)
        first = await _fill_and_submit(client, code)
        again = await client.post("/api/v1/applications", json={"area_code": code})
        assert again.status_code == 409
        assert first["number"] in again.json()["detail"]

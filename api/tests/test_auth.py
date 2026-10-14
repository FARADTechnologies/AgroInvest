import uuid

from tests.conftest import DEMO_PASSWORD, login


def _new_email() -> str:
    return f"user-{uuid.uuid4().hex[:8]}@agro-demo.test"


async def test_register_requires_consent(client):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": _new_email(),
            "password": "Parol123",
            "full_name": "Test İstifadəçi",
            "consent": False,
        },
    )
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")


async def test_register_signs_in_and_creates_entrepreneur(client):
    email = _new_email()
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email.upper(),
            "password": "Parol123",
            "full_name": "Günay Əliyeva",
            "consent": True,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == email
    assert body["role"] == "ENTREPRENEUR"
    assert body["has_profile"] is False

    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["full_name"] == "Günay Əliyeva"


async def test_duplicate_email_is_rejected(client):
    email = _new_email()
    payload = {"email": email, "password": "Parol123", "full_name": "Test Bir", "consent": True}
    assert (await client.post("/api/v1/auth/register", json=payload)).status_code == 201
    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409


async def test_wrong_password_then_lockout(client):
    email = _new_email()
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Parol123", "full_name": "Kilid Test", "consent": True},
    )
    await client.post("/api/v1/auth/logout")
    for _ in range(5):
        r = await client.post("/api/v1/auth/login", json={"email": email, "password": "yanlis-123"})
        assert r.status_code == 401
    locked = await client.post("/api/v1/auth/login", json={"email": email, "password": "Parol123"})
    assert locked.status_code == 423


async def test_bearer_token_for_api_clients(client):
    response = await client.post(
        "/api/v1/auth/token", data={"username": "rehber@agro-demo.test", "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    client.cookies.clear()
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["role"] == "SUPERVISOR"


async def test_profile_validation(client):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": _new_email(),
            "password": "Parol123",
            "full_name": "Profil Test",
            "consent": True,
        },
    )
    bad = await client.put(
        "/api/v1/me/entrepreneur",
        json={
            "type": "COMPANY",
            "voen": "123",
            "full_name": "Profil Test",
            "company_name": "Test MMC",
            "phone": "+994501234567",
            "email": "a@agro-demo.test",
        },
    )
    assert bad.status_code == 422

    good = await client.put(
        "/api/v1/me/entrepreneur",
        json={
            "type": "INDIVIDUAL",
            "fin": "5abc12d",
            "full_name": "Profil Test",
            "phone": "+994 50 123 45 67",
            "email": "a@agro-demo.test",
        },
    )
    assert good.status_code == 200, good.text
    assert good.json()["fin"] == "5ABC12D"
    assert (await client.get("/api/v1/auth/me")).json()["has_profile"] is True


async def test_staff_cannot_use_entrepreneur_profile(specialist):
    response = await specialist.get("/api/v1/me/entrepreneur")
    assert response.status_code == 403


async def test_demo_entrepreneur_has_company_profile(client):
    await login(client, "sahibkar@agro-demo.test")
    profile = (await client.get("/api/v1/me/entrepreneur")).json()
    assert profile["type"] == "COMPANY"
    assert profile["voen"] == "1905832207"

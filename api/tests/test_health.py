import os

os.environ.setdefault("JWT_SECRET", "test-secret")

from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.main import app  # noqa: E402


async def test_liveness() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_openapi_is_served() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    assert response.json()["info"]["title"].startswith("Aqrar")

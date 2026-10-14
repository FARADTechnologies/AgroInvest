"""Integration test setup.

A throw-away database (<name>_test) is created next to the configured one,
migrated with Alembic and seeded with the demo data, so tests exercise the
real schema, constraints and PostGIS functions.
"""

import os
import subprocess
import sys
from pathlib import Path

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DEMO_PASSWORD", "Demo2026!")
os.environ.setdefault("UPLOAD_DIR", "/tmp/portal-test-uploads")
if "SEED_DIR" not in os.environ and not Path("/seed").exists():
    os.environ["SEED_DIR"] = str(Path(__file__).resolve().parents[2] / "seed")

_base_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://agro:agro@localhost:5433/agro")
_prefix, _, _db_name = _base_url.rpartition("/")
TEST_DB = f"{_db_name}_test"
os.environ["DATABASE_URL"] = f"{_prefix}/{TEST_DB}"

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

DEMO_PASSWORD = os.environ["DEMO_PASSWORD"]


async def _recreate_database() -> None:
    admin_dsn = f"{_prefix}/postgres".replace("postgresql+asyncpg", "postgresql")
    conn = await asyncpg.connect(admin_dsn)
    try:
        await conn.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)')
        await conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    finally:
        await conn.close()


@pytest.fixture(scope="session", autouse=True)
async def database():
    await _recreate_database()
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        check=True,
        cwd=Path(__file__).resolve().parents[1],
        env=os.environ.copy(),
    )
    from app.seed.__main__ import seed

    await seed()
    yield
    from app.db.session import engine

    await engine.dispose()


@pytest.fixture
async def client():
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def login(client: AsyncClient, email: str, password: str = DEMO_PASSWORD) -> None:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


@pytest.fixture
async def specialist(client):
    await login(client, "mutexessis@agro-demo.test")
    return client


@pytest.fixture
async def entrepreneur(client):
    await login(client, "sahibkar@agro-demo.test")
    return client

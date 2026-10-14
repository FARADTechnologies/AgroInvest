from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import SessionFactory, engine

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Portal API for the investment competition for agricultural land in the "
        "liberated territories. Designed for future integration with EKTIS."
    ),
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=None,
    openapi_url=f"{settings.api_prefix}/openapi.json",
    lifespan=lifespan,
)


@app.get("/health", tags=["health"], summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(f"{settings.api_prefix}/health", tags=["health"], summary="Readiness probe (checks the DB)")
async def readiness() -> dict[str, str]:
    async with SessionFactory() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}

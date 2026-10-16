import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from sqlalchemy import text

from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.db.session import SessionFactory, engine
from app.modules.applications.admin_router import router as admin_applications_router
from app.modules.applications.router import router as applications_router
from app.modules.areas.admin import router as admin_areas_router
from app.modules.areas.router import router as areas_router
from app.modules.audit.router import router as audit_router
from app.modules.competitions.admin_router import router as admin_competitions_router
from app.modules.competitions.router import router as competitions_router
from app.modules.entrepreneurs.router import router as entrepreneurs_router
from app.modules.geo.router import router as geo_router
from app.modules.geo.tiles import router as tiles_router
from app.modules.identity.admin_router import router as admin_users_router
from app.modules.identity.router import router as auth_router
from app.modules.integration import worker as outbox_worker
from app.modules.integration.router import events_router as ektis_events_router
from app.modules.integration.router import me_router as ektis_check_router
from app.modules.integration.router import router as admin_integration_router
from app.modules.listings.router import router as listings_router
from app.modules.notifications.router import router as notifications_router
from app.modules.reports.router import router as reports_router
from app.modules.suitability.admin import router as admin_suitability_router
from app.modules.suitability.router import router as suitability_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    worker = (
        asyncio.create_task(outbox_worker.run_forever()) if settings.integration_worker else None
    )
    yield
    if worker:
        worker.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker
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
install_error_handlers(app)

api = APIRouter(prefix=settings.api_prefix)
api.include_router(auth_router)
api.include_router(entrepreneurs_router)
api.include_router(geo_router)
api.include_router(tiles_router)
api.include_router(areas_router)
api.include_router(competitions_router)
api.include_router(applications_router)
api.include_router(notifications_router)
api.include_router(admin_applications_router)
api.include_router(admin_competitions_router)
api.include_router(reports_router)
api.include_router(admin_areas_router)
api.include_router(admin_integration_router)
api.include_router(ektis_check_router)
api.include_router(ektis_events_router)
api.include_router(audit_router)
api.include_router(suitability_router)
api.include_router(listings_router)
api.include_router(admin_suitability_router)
api.include_router(admin_users_router)


@api.get("/health", tags=["health"], summary="Readiness probe (checks the DB)")
async def readiness() -> dict[str, str]:
    async with SessionFactory() as session:
        await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}


app.include_router(api)


@app.get("/health", tags=["health"], summary="Liveness probe")
async def health() -> dict[str, str]:
    return {"status": "ok"}

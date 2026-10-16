"""Seed entry point, run by the container on every start.

Loads reference data, farm areas, competitions and demo accounts into an empty
database. Demo data is never touched once present, so restarts are safe. Layers
without user data are kept current on every start: the map's outline and sea are
reloaded, roads and water are loaded if missing, and farm areas without a
suitability result for the current method are scored.
"""

import asyncio
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.db.session import SessionFactory, engine
from app.modules.identity.models import User
from app.modules.suitability import service as suitability
from app.seed.applications import load_applications
from app.seed.areas import backfill_osm_refs, load_areas
from app.seed.demo import load_competitions, load_people
from app.seed.reference import load_reference, load_reference_layers, refresh_map_layers

log = logging.getLogger("seed")


async def seed() -> None:
    settings = get_settings()
    async with SessionFactory() as session:
        await refresh_map_layers(session, settings.seed_dir)
        if loaded := await load_reference_layers(session, settings.seed_dir):
            log.info("Loaded %d reference road and water features.", loaded)
        await session.commit()

        if await session.scalar(select(func.count(User.id))):
            log.info("Database already seeded; demo data left as it is.")
            if filled := await backfill_osm_refs(session, settings.seed_dir):
                log.info("Stored the OpenStreetMap way ID of %d farm areas.", filled)
        else:
            await load_demo(session, settings)

        if scored := await suitability.refresh_missing(session):
            log.info("Scored the suitability of %d farm areas.", scored)
        await session.commit()


async def load_demo(session: AsyncSession, settings: Settings) -> None:
    if not settings.demo_password:
        raise SystemExit("DEMO_PASSWORD must be set to create the demo accounts")
    rayons = await load_reference(session, settings.seed_dir)
    areas = await load_areas(session, settings.seed_dir, rayons)
    people = await load_people(session, [r.id for r in rayons.values()])
    rayon_iso = {r.id: iso for iso, r in rayons.items()}
    competitions = await load_competitions(session, people, areas, rayon_iso)
    applications = await load_applications(session, people, competitions)
    await session.commit()
    log.info(
        "Seeded %d rayons, %d farm areas, %d competitions, %d applications and the demo accounts.",
        len(rayons),
        len(areas),
        len(competitions),
        applications,
    )


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    try:
        await seed()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

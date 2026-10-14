"""Seed entry point, run by the container on every start.

Loads reference data, farm areas, competitions and demo accounts into an empty
database. It does nothing when data is already present, so restarts are safe.
"""

import asyncio
import logging

from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.session import SessionFactory, engine
from app.modules.identity.models import User
from app.seed.applications import load_applications
from app.seed.areas import load_areas
from app.seed.demo import load_competitions, load_people
from app.seed.reference import load_reference

log = logging.getLogger("seed")


async def seed() -> None:
    settings = get_settings()
    async with SessionFactory() as session:
        if await session.scalar(select(func.count(User.id))):
            log.info("Database already seeded; nothing to do.")
            return
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

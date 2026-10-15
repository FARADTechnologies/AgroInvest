"""Re-scores every farm area with the active method: `python -m app.modules.suitability`.

Needed after the factor sources change (a new CSV in SUITABILITY_SOURCES, recalibrated demo
values); saving a new method version in the admin re-scores on its own.
"""

import asyncio

import app.db.models  # noqa: F401  (registers every table for the foreign keys)
from app.db.session import SessionFactory
from app.modules.suitability import service


async def main() -> None:
    async with SessionFactory() as session:
        count = await service.recompute_all(session)
        await session.commit()
    print(f"Re-scored {count} farm areas.")


asyncio.run(main())

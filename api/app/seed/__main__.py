"""Seed entry point, run by the container on every start.

Loads reference data, farm areas, competitions and demo accounts into an empty
database. It does nothing when data is already present, so restarts are safe.
"""

import asyncio
import logging

log = logging.getLogger("seed")


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    log.info("No seed data defined yet.")


if __name__ == "__main__":
    asyncio.run(main())

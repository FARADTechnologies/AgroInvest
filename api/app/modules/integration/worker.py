"""Background work started with the API process: delivers EKTIS outbox messages and
seals new audit entries into the hash chain.

One loop is enough for the prototype; `FOR UPDATE SKIP LOCKED` in `process_due`
keeps it correct when several API replicas run their own loop in production.
"""

import asyncio
import logging

from app.core.config import get_settings
from app.db.session import SessionFactory
from app.modules.audit import service as audit
from app.modules.integration import service
from app.modules.integration.client import get_ektis_client

log = logging.getLogger("integration.worker")


async def run_forever() -> None:
    interval = get_settings().integration_poll_seconds
    client = get_ektis_client()
    while True:
        try:
            async with SessionFactory() as session:
                await service.process_due(session, client)
            async with SessionFactory() as session:
                await audit.seal(session)  # chain new audit entries
                await session.commit()
        except asyncio.CancelledError:
            raise
        except Exception:  # keep delivering after an unexpected error; it is logged
            log.exception("outbox delivery round failed")
        await asyncio.sleep(interval)

"""EKTIS integration: transactional outbox, delivery with retries, farmer lookup, log.

Flow of a decision: the specialist decides → the same transaction writes an outbox
message → the worker sends it to EKTIS → success marks it SENT with the EKTIS
reference; a failure is logged and retried with a growing delay, so an EKTIS outage
never blocks or loses a decision. Every call is logged with its correlation id.
"""

import hashlib
import hmac
import logging
import time
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.masking import mask_identifier
from app.modules.applications.models import Application, Outcome
from app.modules.areas.models import FarmArea
from app.modules.competitions.models import Competition
from app.modules.entrepreneurs.models import Entrepreneur
from app.modules.geo.models import Rayon
from app.modules.identity.models import User
from app.modules.integration.client import EktisClient, EktisResult
from app.modules.integration.models import (
    IntegrationEvent,
    IntegrationLog,
    IntegrationOutbox,
    OutboxStatus,
)

log = logging.getLogger("integration")

DECISION = "LAND_USE_DECISION"
MAX_ATTEMPTS = 12
MAX_DELAY_S = 30


def backoff(attempts: int) -> timedelta:
    """5 s, 10 s, 20 s, then every 30 s: quick recovery after a short outage."""
    return timedelta(seconds=min(MAX_DELAY_S, 5 * 2 ** max(0, attempts - 1)))


def new_request_id() -> str:
    return str(uuid.uuid4())


def record(
    session: AsyncSession,
    operation: str,
    result: EktisResult,
    summary: str | None = None,
    outbox_id: uuid.UUID | None = None,
    actor: User | None = None,
    direction: str = "OUT",
) -> None:
    session.add(
        IntegrationLog(
            direction=direction,
            operation=operation,
            method=result.method,
            path=result.path,
            status_code=result.status_code,
            ok=result.ok,
            duration_ms=result.duration_ms,
            request_id=result.request_id,
            summary=summary,
            error=result.error,
            outbox_id=outbox_id,
            actor_id=actor.id if actor else None,
        )
    )


async def enqueue_decision(session: AsyncSession, app: Application) -> IntegrationOutbox | None:
    """Writes the EKTIS message for a winning decision; call inside the decision transaction.

    Only a granted right to use land is reported: EKTIS registers land use, and a
    declined application changes nothing there.
    """
    if app.outcome != Outcome.WON:
        return None
    area = await session.get(FarmArea, app.farm_area_id)
    competition = await session.get(Competition, app.competition_id)
    rayon = await session.get(Rayon, area.rayon_id) if area else None
    centroid = (
        await session.execute(
            select(func.ST_X(FarmArea.centroid), func.ST_Y(FarmArea.centroid)).where(
                FarmArea.id == app.farm_area_id
            )
        )
    ).one()
    snap = app.applicant_snapshot or {}
    payload = {
        "decisionId": str(app.id),
        "applicationNumber": app.number,
        "competitionNumber": competition.number if competition else None,
        "outcome": app.outcome.value,
        "decidedAt": (app.decided_at or datetime.now(UTC)).isoformat(),
        "reason": app.decision_reason,
        "leaseTermYears": area.lease_term_years if area else None,
        "parcel": {
            "code": area.code if area else None,
            "areaHa": float(area.area_ha) if area else None,
            "rayonIso": rayon.iso_code if rayon else None,
            "purpose": area.purpose.value if area else None,
            "centroid": [round(centroid[0], 6), round(centroid[1], 6)],
        },
        "applicant": {
            "type": snap.get("type"),
            "fin": snap.get("fin"),
            "voen": snap.get("voen"),
            "name": snap.get("company_name") or snap.get("full_name"),
            "ektisFarmerId": snap.get("ektis_farmer_id"),
        },
    }
    message = IntegrationOutbox(kind=DECISION, application_id=app.id, payload=payload)
    session.add(message)
    return message


async def deliver(session: AsyncSession, message: IntegrationOutbox, client: EktisClient) -> bool:
    """One delivery attempt; records the call and schedules the next attempt on failure."""
    result = await client.send_decision(message.payload, new_request_id())
    number = message.payload.get("applicationNumber")
    message.attempts += 1
    if result.ok:
        message.status = OutboxStatus.SENT
        message.sent_at = datetime.now(UTC)
        message.last_error = None
        message.ektis_reference = (result.data or {}).get("ektisReference")
        summary = f"{number}: qəbul edildi, {message.ektis_reference}"
    else:
        message.last_error = result.error
        if message.attempts >= MAX_ATTEMPTS:
            message.status = OutboxStatus.FAILED
            summary = f"{number}: {message.attempts} cəhd uğursuz, əl ilə yenidən göndərilməlidir"
        else:
            message.next_attempt_at = datetime.now(UTC) + backoff(message.attempts)
            summary = f"{number}: cəhd {message.attempts} uğursuz, yenidən cəhd ediləcək"
    record(session, "decision.send", result, summary, message.id)
    return result.ok


async def process_due(session: AsyncSession, client: EktisClient, limit: int = 10) -> int:
    """Delivers the messages whose next attempt is due. Safe with several workers."""
    messages = (
        await session.scalars(
            select(IntegrationOutbox)
            .where(
                IntegrationOutbox.status == OutboxStatus.PENDING,
                IntegrationOutbox.next_attempt_at <= func.now(),
            )
            .order_by(IntegrationOutbox.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    ).all()
    for message in messages:
        await deliver(session, message, client)
    await session.commit()
    return len(messages)


async def resume_pending(session: AsyncSession) -> int:
    """Makes every waiting or failed message due now (after EKTIS is back, or by hand)."""
    messages = (
        await session.scalars(
            select(IntegrationOutbox).where(
                IntegrationOutbox.status.in_([OutboxStatus.PENDING, OutboxStatus.FAILED])
            )
        )
    ).all()
    now = datetime.now(UTC)
    for message in messages:
        message.status = OutboxStatus.PENDING
        message.next_attempt_at = now
        if message.attempts >= MAX_ATTEMPTS:
            message.attempts = 0
    return len(messages)


async def lookup_farmer(
    session: AsyncSession, profile: Entrepreneur, user: User, client: EktisClient
) -> EktisResult:
    """Checks the applicant's own FİN/VÖEN in the EKTIS farmer registry and remembers the id."""
    identifier = profile.fin or profile.voen or ""
    label = "FİN" if profile.fin else "VÖEN"
    result = await client.lookup_farmer(
        fin=profile.fin, voen=profile.voen, request_id=new_request_id()
    )
    if result.ok:
        profile.ektis_farmer_id = (result.data or {}).get("farmerId")
        outcome = f"tapıldı ({profile.ektis_farmer_id})"
    elif result.status_code == 404:
        profile.ektis_farmer_id = None
        outcome = "EKTİS-də qeydiyyatda deyil"
    else:
        outcome = "cavab alınmadı"
    record(
        session,
        "farmer.lookup",
        result,
        f"{label} {mask_identifier(identifier)}: {outcome}",
        actor=user,
    )
    return result


# ── Callbacks from EKTIS ────────────────────────────────────────────────────

SIGNATURE_MAX_AGE_S = 300


def valid_signature(secret: str, timestamp: str | None, signature: str | None, body: bytes) -> bool:
    """`X-Signature: sha256=<hex>` over "<timestamp>.<body>", at most five minutes old."""
    if not secret or not timestamp or not signature or not timestamp.isdigit():
        return False
    if abs(time.time() - int(timestamp)) > SIGNATURE_MAX_AGE_S:
        return False
    expected = hmac.new(
        secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


async def apply_event(session: AsyncSession, event_id: str, event: dict) -> tuple[bool, str]:
    """Stores the event once and marks the decision's message as confirmed by EKTIS.

    Returns (applied, summary); a repeated event id is recognised and changes nothing.
    """
    if await session.scalar(
        select(IntegrationEvent.id).where(IntegrationEvent.event_id == event_id)
    ):
        return False, f"Təkrar hadisə {event_id[:8]}: artıq emal olunub"
    decision_id = str(event.get("decisionId") or "")
    session.add(
        IntegrationEvent(
            event_id=event_id,
            type=str(event.get("type") or "UNKNOWN")[:60],
            decision_id=decision_id[:64] or None,
            payload=event,
        )
    )
    message = await session.scalar(
        select(IntegrationOutbox).where(
            IntegrationOutbox.payload["decisionId"].astext == decision_id
        )
    )
    number = event.get("applicationNumber") or "?"
    if message is None:
        return True, f"{number}: hadisə qəbul edildi, uyğun mesaj tapılmadı"
    message.confirmed_at = datetime.now(UTC)
    message.land_use_right_id = event.get("landUseRightId")
    return True, f"{number}: EKTİS qeydiyyatı təsdiqlədi ({message.land_use_right_id})"

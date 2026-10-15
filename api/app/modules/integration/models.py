import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import str_enum


class OutboxStatus(StrEnum):
    PENDING = "PENDING"  # waiting for its first or next attempt
    SENT = "SENT"  # acknowledged by EKTIS
    FAILED = "FAILED"  # gave up after the maximum attempts; a person can resend it


class IntegrationOutbox(Base):
    """A message for EKTIS, written in the same transaction as the decision it reports.

    The decision can never be committed without its message, and a temporary EKTIS
    outage never blocks the specialist: the worker delivers the message later.
    """

    __tablename__ = "integration_outbox"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(40))  # LAND_USE_DECISION
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("application.id", ondelete="SET NULL"), index=True
    )
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[OutboxStatus] = mapped_column(
        str_enum(OutboxStatus), default=OutboxStatus.PENDING, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_error: Mapped[str | None] = mapped_column(String(500))
    ektis_reference: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Set by EKTIS's signed callback once it has registered the land-use right.
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    land_use_right_id: Mapped[str | None] = mapped_column(String(60))


class IntegrationLog(Base):
    """Every call to EKTIS: what, when, how long, the result and the correlation id.

    Identifiers are stored masked; the log is for operations, not personal data.
    """

    __tablename__ = "integration_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    system: Mapped[str] = mapped_column(String(20), default="EKTIS")
    direction: Mapped[str] = mapped_column(
        String(3), default="OUT", server_default="OUT"
    )  # OUT | IN
    operation: Mapped[str] = mapped_column(String(60))  # farmer.lookup, decision.send, mock.fault
    method: Mapped[str] = mapped_column(String(8))
    path: Mapped[str] = mapped_column(String(200))
    status_code: Mapped[int | None] = mapped_column(Integer)
    ok: Mapped[bool] = mapped_column(Boolean)
    duration_ms: Mapped[int] = mapped_column(Integer)
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    summary: Mapped[str | None] = mapped_column(String(300))
    error: Mapped[str | None] = mapped_column(String(300))
    outbox_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("integration_outbox.id", ondelete="SET NULL")
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))


class IntegrationEvent(Base):
    """An event EKTIS sent to the portal (callback). The event id makes processing idempotent:
    a repeated delivery is recognised and not applied twice."""

    __tablename__ = "integration_event"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[str] = mapped_column(String(64), unique=True)
    type: Mapped[str] = mapped_column(String(60))
    decision_id: Mapped[str | None] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSONB)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

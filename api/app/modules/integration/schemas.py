import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.modules.integration.models import OutboxStatus


class OutboxOut(BaseModel):
    id: uuid.UUID
    kind: str
    application_id: uuid.UUID | None
    application_number: str | None
    area_code: str | None
    status: OutboxStatus
    attempts: int
    next_attempt_at: datetime
    last_error: str | None
    ektis_reference: str | None
    created_at: datetime
    sent_at: datetime | None


class LogOut(BaseModel):
    id: int
    created_at: datetime
    operation: str
    method: str
    path: str
    status_code: int | None
    ok: bool
    duration_ms: int
    request_id: str
    summary: str | None
    error: str | None


class IntegrationStatus(BaseModel):
    mode: str  # mock | disabled
    reachable: bool
    fault: str | None  # NONE, DOWN, SLOW, ERROR_RATE (mock only)
    pending: int
    sent: int
    failed: int


class FaultIn(BaseModel):
    mode: Literal["NONE", "DOWN", "SLOW"]


class FarmerCheck(BaseModel):
    """Result of checking the applicant's own FİN/VÖEN in the EKTIS farmer registry."""

    available: bool  # False when EKTIS did not answer
    registered: bool
    farmer_id: str | None = None
    name: str | None = None
    registered_on: date | None = None
    rayon_iso: str | None = None
    declared_land_ha: Decimal | None = None
    activities: list[str] = []
    message: str

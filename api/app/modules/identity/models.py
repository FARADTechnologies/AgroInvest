import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.db.types import str_enum


class Role(StrEnum):
    INVESTOR = "INVESTOR"  # İnvestor: states a budget and interests, applies to listings
    ENTREPRENEUR = "ENTREPRENEUR"  # Sahibkar: registers and places listings (elanlar)
    SPECIALIST = "SPECIALIST"  # Mütəxəssis: manages areas and competitions, reviews applications
    SUPERVISOR = "SUPERVISOR"  # Rəhbər: approves competitions (maker-checker)
    ADMIN = "ADMIN"


STAFF_ROLES = frozenset({Role.SPECIALIST, Role.SUPERVISOR, Role.ADMIN})


class User(Base, TimestampMixin):
    __tablename__ = "app_user"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[Role] = mapped_column(str_enum(Role))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Consent to personal-data processing, required at registration.
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str | None] = mapped_column(String(20))

    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

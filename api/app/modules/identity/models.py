import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import ARRAY, Boolean, DateTime, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.db.types import str_enum


class Role(StrEnum):
    INVESTOR = "INVESTOR"  # Portal user: Azerbaijani or foreign citizen, applies to listings
    ENTREPRENEUR = "ENTREPRENEUR"  # Former sahibkar role; no longer assigned (migration 0010)
    SPECIALIST = "SPECIALIST"  # Mütəxəssis: manages areas and competitions, reviews applications
    SUPERVISOR = "SUPERVISOR"  # Rəhbər: approves competitions (maker-checker)
    STAFF = "STAFF"  # İşçi: position and permissions set by the administrator
    ADMIN = "ADMIN"  # Administrator: every permission; the only one who manages staff


STAFF_ROLES = frozenset({Role.SPECIALIST, Role.SUPERVISOR, Role.STAFF, Role.ADMIN})


class User(Base, TimestampMixin):
    __tablename__ = "app_user"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[Role] = mapped_column(str_enum(Role))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Staff only: job title shown in the console, and the permissions the administrator
    # granted (None: the role's defaults, see identity.permissions).
    position: Mapped[str | None] = mapped_column(String(120))
    permissions: Mapped[list[str] | None] = mapped_column(ARRAY(String(32)))

    # Consent to personal-data processing, required at registration.
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str | None] = mapped_column(String(20))

    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

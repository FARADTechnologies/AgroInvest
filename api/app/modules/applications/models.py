import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.types import str_enum
from app.modules.areas.models import Purpose


class ApplicationStatus(StrEnum):
    DRAFT = "DRAFT"  # Qaralama
    RECEIVED = "RECEIVED"  # Qəbul edilib
    UNDER_REVIEW = "UNDER_REVIEW"  # Baxılır
    INFO_REQUESTED = "INFO_REQUESTED"  # Əlavə məlumat tələb olunur
    DECIDED = "DECIDED"  # Qərar verilib


class Outcome(StrEnum):
    WON = "WON"  # Qalib
    REJECTED = "REJECTED"  # İmtina


class Application(Base, TimestampMixin):
    """Müraciət: an entrepreneur's bid for one farm area in one competition."""

    __tablename__ = "application"
    __table_args__ = (
        ForeignKeyConstraint(
            ["competition_id", "farm_area_id"],
            ["competition_area.competition_id", "competition_area.farm_area_id"],
            name="fk_application_competition_area",
        ),
        # One application per entrepreneur per area in a competition.
        UniqueConstraint(
            "entrepreneur_id", "competition_id", "farm_area_id", name="uq_application_once"
        ),
        # At most one winner per area in a competition ("sahə üzrə nəticə").
        Index(
            "uq_application_one_winner",
            "competition_id",
            "farm_area_id",
            unique=True,
            postgresql_where=text("outcome = 'WON'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Assigned at submission from a database sequence: QIM-2026-000123.
    number: Mapped[str | None] = mapped_column(String(20), unique=True)
    entrepreneur_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("entrepreneur.id"))
    competition_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    farm_area_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    activity: Mapped[Purpose] = mapped_column(str_enum(Purpose))
    project_title: Mapped[str | None] = mapped_column(String(200))

    # Applicant profile frozen at submission; later profile edits do not change it.
    applicant_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    status: Mapped[ApplicationStatus] = mapped_column(str_enum(ApplicationStatus))
    outcome: Mapped[Outcome | None] = mapped_column(str_enum(Outcome, 12))
    decision_reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_status_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Optimistic locking: two reviewers cannot overwrite each other silently.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    __mapper_args__ = {"version_id_col": version}

    business_plan: Mapped["BusinessPlan | None"] = relationship(
        back_populates="application", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )


class BusinessPlan(Base):
    """Investment and business plan data (R3.4). Fields are optional while drafting."""

    __tablename__ = "business_plan"

    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("application.id", ondelete="CASCADE"), primary_key=True
    )
    investment_azn: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    own_funds_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    jobs_planned: Mapped[int | None] = mapped_column(Integer)
    jobs_local: Mapped[int | None] = mapped_column(Integer)
    implementation_months: Mapped[int | None] = mapped_column(Integer)
    experience_years: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(Text)
    products_market: Mapped[str | None] = mapped_column(Text)
    technology: Mapped[str | None] = mapped_column(Text)
    water_plan: Mapped[str | None] = mapped_column(Text)

    application: Mapped[Application] = relationship(back_populates="business_plan")


class StatusHistory(Base):
    """Append-only record of every status change, with who and why (R4.3)."""

    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("application.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[ApplicationStatus | None] = mapped_column(
        str_enum(ApplicationStatus, name="from_status")
    )
    to_status: Mapped[ApplicationStatus] = mapped_column(
        str_enum(ApplicationStatus, name="to_status")
    )
    outcome: Mapped[Outcome | None] = mapped_column(str_enum(Outcome, 12))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    actor_role: Mapped[str | None] = mapped_column(String(20))
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InfoRequest(Base):
    """ "Əlavə məlumat tələb olunur": what the specialist asked for and the applicant's answer."""

    __tablename__ = "info_request"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("application.id", ondelete="CASCADE"), index=True
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"))
    message: Mapped[str] = mapped_column(Text)
    requested_doc_types: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    response_text: Mapped[str | None] = mapped_column(Text)

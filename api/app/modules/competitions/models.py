import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.types import str_enum
from app.modules.areas.models import FarmArea


class CompetitionStatus(StrEnum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PUBLISHED = "PUBLISHED"
    CLOSED = "CLOSED"
    RESULTS_ANNOUNCED = "RESULTS_ANNOUNCED"
    CANCELLED = "CANCELLED"


class Competition(Base, TimestampMixin):
    """Müsabiqə: one or more farm areas offered to entrepreneurs until a deadline."""

    __tablename__ = "competition"
    # Maker-checker between staff (the approver is never the creator) is enforced in
    # service._check_reviewer; the administrator may approve their own competition.

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    number: Mapped[str] = mapped_column(String(20), unique=True)  # e.g. MS-2026-007
    title_az: Mapped[str] = mapped_column(String(300))
    description_az: Mapped[str] = mapped_column(Text)
    conditions_az: Mapped[str] = mapped_column(Text)
    opens_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[CompetitionStatus] = mapped_column(str_enum(CompetitionStatus))

    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_comment: Mapped[str | None] = mapped_column(Text)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    areas: Mapped[list["CompetitionArea"]] = relationship(
        back_populates="competition",
        cascade="all, delete-orphan",
        order_by="CompetitionArea.lot_no",
    )
    required_documents: Mapped[list["CompetitionRequiredDoc"]] = relationship(
        cascade="all, delete-orphan"
    )


class CompetitionArea(Base):
    __tablename__ = "competition_area"

    competition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("competition.id", ondelete="CASCADE"), primary_key=True
    )
    farm_area_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("farm_area.id"), primary_key=True)
    lot_no: Mapped[int] = mapped_column(Integer)
    min_investment_azn: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))

    competition: Mapped[Competition] = relationship(back_populates="areas")
    farm_area: Mapped[FarmArea] = relationship(lazy="joined")


class DocumentType(Base):
    __tablename__ = "document_type"

    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    name_az: Mapped[str] = mapped_column(String(200))
    description_az: Mapped[str | None] = mapped_column(Text)
    applies_to: Mapped[str] = mapped_column(String(12), default="ANY")  # ANY | INDIVIDUAL | COMPANY
    max_mb: Mapped[int] = mapped_column(Integer, default=10)


class CompetitionRequiredDoc(Base):
    __tablename__ = "competition_required_doc"

    competition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("competition.id", ondelete="CASCADE"), primary_key=True
    )
    doc_type_code: Mapped[str] = mapped_column(ForeignKey("document_type.code"), primary_key=True)
    mandatory: Mapped[bool] = mapped_column(Boolean, default=True)

    document_type: Mapped[DocumentType] = relationship(lazy="joined")

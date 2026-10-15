import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SuitabilityMethod(Base):
    """A version of the suitability method: the experts' AHP pairwise matrices per activity.

    Saving a new version re-scores every farm area; earlier versions stay for the record.
    """

    __tablename__ = "suitability_method"

    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    matrices: Mapped[dict] = mapped_column(JSONB)
    comment: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Notification(Base):
    """In-app notification (R4.4). E-mail and SMS delivery are on the roadmap."""

    __tablename__ = "notification"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title_az: Mapped[str] = mapped_column(String(200))
    body_az: Mapped[str] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(300))
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("application.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

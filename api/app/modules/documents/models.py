import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ApplicationDocument(Base):
    """An uploaded file's metadata; the bytes live in DocumentBlob under a random name."""

    __tablename__ = "application_document"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("application.id", ondelete="CASCADE"), index=True
    )
    doc_type_code: Mapped[str] = mapped_column(ForeignKey("document_type.code"))
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(64), unique=True)
    mime: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"))
    info_request_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("info_request.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentBlob(Base):
    """The bytes of an uploaded file, kept in the database so they survive restarts and
    redeploys of the API (hosted containers have no persistent disk). A separate table, so
    listing documents never loads file contents."""

    __tablename__ = "document_blob"

    stored_name: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

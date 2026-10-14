import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, status
from pydantic import BaseModel
from sqlalchemy import func, select, update

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import not_found
from app.modules.notifications.models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    title_az: str
    body_az: str
    link: str | None
    created_at: datetime
    read_at: datetime | None

    model_config = {"from_attributes": True}


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int


@router.get("", response_model=NotificationList)
async def my_notifications(user: CurrentUser, session: SessionDep) -> NotificationList:
    rows = (
        await session.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
    ).all()
    unread = await session.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id, Notification.read_at.is_(None)
        )
    )
    return NotificationList(
        items=[NotificationOut.model_validate(n) for n in rows], unread=unread or 0
    )


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> None:
    n = await session.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise not_found()
    if n.read_at is None:
        n.read_at = datetime.now(UTC)
        await session.commit()


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(user: CurrentUser, session: SessionDep) -> None:
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    await session.commit()

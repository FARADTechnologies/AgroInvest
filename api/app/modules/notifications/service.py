import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification


def notify(
    session: AsyncSession,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str,
    link: str | None = None,
    application_id: uuid.UUID | None = None,
) -> Notification:
    """Queues an in-app notification in the caller's transaction."""
    notification = Notification(
        user_id=user_id,
        kind=kind,
        title_az=title,
        body_az=body,
        link=link,
        application_id=application_id,
    )
    session.add(notification)
    return notification

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import DomainError, conflict
from app.core.security import burn_verification_time, hash_password, verify_password
from app.modules.entrepreneurs.models import Entrepreneur
from app.modules.identity.models import Role, User
from app.modules.identity.schemas import CONSENT_VERSION, RegisterRequest, UserOut


def normalise_email(email: str) -> str:
    return email.strip().lower()


async def register(session: AsyncSession, data: RegisterRequest) -> User:
    email = normalise_email(data.email)
    exists = await session.scalar(select(User.id).where(User.email == email))
    if exists:
        raise conflict("email_taken", "Bu e-poçt ilə hesab artıq mövcuddur")
    user = User(
        email=email,
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
        role=Role.ENTREPRENEUR,
        consent_at=datetime.now(UTC),
        consent_version=CONSENT_VERSION,
    )
    session.add(user)
    await session.commit()
    return user


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    """Checks credentials with a per-account lockout after repeated failures."""
    settings = get_settings()
    invalid = DomainError(401, "invalid_credentials", "E-poçt və ya şifrə yanlışdır")
    user = await session.scalar(select(User).where(User.email == normalise_email(email)))
    if user is None:
        burn_verification_time(password)
        raise invalid

    now = datetime.now(UTC)
    if user.locked_until and user.locked_until > now:
        minutes = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
        raise DomainError(
            423,
            "account_locked",
            f"Çox sayda uğursuz cəhd. {minutes} dəqiqə sonra yenidən yoxlayın",
        )

    if not verify_password(password, user.password_hash) or not user.is_active:
        user.failed_logins += 1
        if user.failed_logins >= settings.max_failed_logins:
            user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
            user.failed_logins = 0
        await session.commit()
        raise invalid

    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = now
    await session.commit()
    return user


async def to_user_out(session: AsyncSession, user: User) -> UserOut:
    has_profile = bool(
        await session.scalar(select(Entrepreneur.id).where(Entrepreneur.user_id == user.id))
    )
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        has_profile=has_profile,
    )

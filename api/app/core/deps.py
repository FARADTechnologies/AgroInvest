"""Request dependencies: database session, current user and role checks.

Every protected endpoint declares the roles it accepts. Ownership checks
(an entrepreneur sees only their own applications) live in the services.
"""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import DomainError, forbidden
from app.core.security import decode_access_token
from app.db.session import get_session
from app.modules.identity.models import Role, User

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Swagger and system clients send a Bearer token; the web UI uses the httpOnly cookie.
_bearer = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


async def get_optional_user(
    request: Request,
    session: SessionDep,
    bearer_token: Annotated[str | None, Depends(_bearer)],
) -> User | None:
    token = bearer_token or request.cookies.get(get_settings().cookie_name)
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user = await session.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        return None
    return user


async def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise DomainError(401, "unauthenticated", "Daxil olmaq tələb olunur")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_roles(*roles: Role) -> Callable:
    allowed = frozenset(roles)

    async def _check(user: CurrentUser, request: Request) -> User:
        if user.role not in allowed:
            await _audit_denied(user, request)
            raise forbidden()
        return user

    return _check


async def _audit_denied(user: User, request: Request) -> None:
    """Records a call to an endpoint the user's role does not allow. Written in its own
    session: the request itself fails, but the attempt must stay in the audit log."""
    from app.db.session import SessionFactory
    from app.modules.audit import service as audit

    async with SessionFactory() as session:
        audit.record(
            session,
            user,
            "access.denied",
            "endpoint",
            request.url.path[:64],
            {"method": request.method, "role": user.role.value},
            request.client.host if request.client else None,
        )
        await session.commit()


InvestorUser = Annotated[User, Depends(require_roles(Role.INVESTOR))]
# Outside parties with an identity profile: investors and sahibkars.
PartyUser = Annotated[User, Depends(require_roles(Role.INVESTOR, Role.ENTREPRENEUR))]
StaffUser = Annotated[User, Depends(require_roles(Role.SPECIALIST, Role.SUPERVISOR, Role.ADMIN))]
SpecialistUser = Annotated[User, Depends(require_roles(Role.SPECIALIST, Role.ADMIN))]
SupervisorUser = Annotated[User, Depends(require_roles(Role.SUPERVISOR, Role.ADMIN))]
# The portal administrator: the only one who puts land on offer and places listings.
AdminUser = Annotated[User, Depends(require_roles(Role.ADMIN))]

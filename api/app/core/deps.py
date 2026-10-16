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
from app.core.ratelimit import client_ip
from app.core.security import decode_access_token
from app.db.session import get_session
from app.modules.identity.models import Role, User
from app.modules.identity.permissions import Permission, has

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
            client_ip(request),
        )
        await session.commit()


def require_permission(permission: Permission) -> Callable:
    """Staff endpoint guarded by one permission from the administration console."""

    async def _check(user: CurrentUser, request: Request) -> User:
        if not has(user, permission):
            await _audit_denied(user, request)
            raise forbidden()
        return user

    return _check


InvestorUser = Annotated[User, Depends(require_roles(Role.INVESTOR))]
# Outside parties with an identity profile: investors and sahibkars.
PartyUser = Annotated[User, Depends(require_roles(Role.INVESTOR, Role.ENTREPRENEUR))]
# Anyone who signs in to the administration console.
StaffUser = Annotated[
    User, Depends(require_roles(Role.SPECIALIST, Role.SUPERVISOR, Role.STAFF, Role.ADMIN))
]
# The administrator: every permission, and the only one who manages staff accounts.
AdminUser = Annotated[User, Depends(require_roles(Role.ADMIN))]

# One permission each; the administrator grants them per account.
ApplicationsViewer = Annotated[User, Depends(require_permission(Permission.APPLICATIONS_VIEW))]
ApplicationsDecider = Annotated[User, Depends(require_permission(Permission.APPLICATIONS_DECIDE))]
IdentifierRevealer = Annotated[User, Depends(require_permission(Permission.IDENTIFIER_REVEAL))]
AreaManager = Annotated[User, Depends(require_permission(Permission.AREAS_MANAGE))]
CompetitionManager = Annotated[User, Depends(require_permission(Permission.COMPETITIONS_MANAGE))]
CompetitionApprover = Annotated[User, Depends(require_permission(Permission.COMPETITIONS_APPROVE))]
ListingManager = Annotated[User, Depends(require_permission(Permission.LISTINGS_MANAGE))]
StatsViewer = Annotated[User, Depends(require_permission(Permission.STATS_VIEW))]
SuitabilityManager = Annotated[User, Depends(require_permission(Permission.SUITABILITY_MANAGE))]
IntegrationManager = Annotated[User, Depends(require_permission(Permission.INTEGRATION_MANAGE))]
AuditViewer = Annotated[User, Depends(require_permission(Permission.AUDIT_VIEW))]

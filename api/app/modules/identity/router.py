from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import get_settings
from app.core.deps import CurrentUser, OptionalUser, SessionDep
from app.core.errors import DomainError
from app.core.ratelimit import SlidingWindow, client_ip, too_many_requests
from app.core.security import create_access_token
from app.modules.identity import service
from app.modules.identity.models import User
from app.modules.identity.schemas import (
    LoginRequest,
    RegisterRequest,
    SessionOut,
    TokenOut,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_settings = get_settings()
# Failed sign-ins per IP (the per-account lockout cannot see one IP trying many accounts).
LOGIN_FAILURES = SlidingWindow(
    _settings.login_failures_per_ip, _settings.login_failure_window_minutes * 60
)
REGISTRATIONS = SlidingWindow(_settings.registrations_per_ip_hour, 3600)


async def _authenticate(session, email: str, password: str, ip: str) -> User:
    if wait := LOGIN_FAILURES.retry_after(ip):
        raise too_many_requests(wait)
    try:
        return await service.authenticate(session, email, password)
    except DomainError as exc:
        if exc.status_code in (401, 423):
            LOGIN_FAILURES.add(ip)
        raise


def _set_session_cookie(response: Response, user: User) -> None:
    settings = get_settings()
    token, expires = create_access_token(user.id, user.role.value)
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.access_token_minutes * 60,
        expires=expires,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest, session: SessionDep, response: Response, request: Request
) -> UserOut:
    """Creates an entrepreneur account (consent required) and signs it in."""
    ip = client_ip(request)
    if wait := REGISTRATIONS.retry_after(ip):
        raise too_many_requests(wait)
    user = await service.register(session, data)
    REGISTRATIONS.add(ip)
    _set_session_cookie(response, user)
    return await service.to_user_out(session, user)


@router.post("/login", response_model=UserOut)
async def login(
    data: LoginRequest, session: SessionDep, response: Response, request: Request
) -> UserOut:
    """Signs in with e-mail and password; the session is an httpOnly cookie."""
    user = await _authenticate(session, data.email, data.password, client_ip(request))
    _set_session_cookie(response, user)
    return await service.to_user_out(session, user)


@router.post("/token", response_model=TokenOut, summary="Bearer token for API clients and Swagger")
async def token(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep, request: Request
) -> TokenOut:
    user = await _authenticate(session, form.username, form.password, client_ip(request))
    access_token, expires = create_access_token(user.id, user.role.value)
    return TokenOut(access_token=access_token, expires_at=expires)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(get_settings().cookie_name, path="/")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser, session: SessionDep) -> UserOut:
    return await service.to_user_out(session, user)


@router.get(
    "/session", response_model=SessionOut, summary="Current session; user is null for visitors"
)
async def current_session(user: OptionalUser, session: SessionDep) -> SessionOut:
    return SessionOut(user=await service.to_user_out(session, user) if user else None)

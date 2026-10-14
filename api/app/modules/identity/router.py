from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import get_settings
from app.core.deps import CurrentUser, SessionDep
from app.core.security import create_access_token
from app.modules.identity import service
from app.modules.identity.models import User
from app.modules.identity.schemas import LoginRequest, RegisterRequest, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


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
async def register(data: RegisterRequest, session: SessionDep, response: Response) -> UserOut:
    """Creates an entrepreneur account (consent required) and signs it in."""
    user = await service.register(session, data)
    _set_session_cookie(response, user)
    return await service.to_user_out(session, user)


@router.post("/login", response_model=UserOut)
async def login(data: LoginRequest, session: SessionDep, response: Response) -> UserOut:
    """Signs in with e-mail and password; the session is an httpOnly cookie."""
    user = await service.authenticate(session, data.email, data.password)
    _set_session_cookie(response, user)
    return await service.to_user_out(session, user)


@router.post("/token", response_model=TokenOut, summary="Bearer token for API clients and Swagger")
async def token(
    form: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep
) -> TokenOut:
    user = await service.authenticate(session, form.username, form.password)
    access_token, expires = create_access_token(user.id, user.role.value)
    return TokenOut(access_token=access_token, expires_at=expires)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    response.delete_cookie(get_settings().cookie_name, path="/")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser, session: SessionDep) -> UserOut:
    return await service.to_user_out(session, user)

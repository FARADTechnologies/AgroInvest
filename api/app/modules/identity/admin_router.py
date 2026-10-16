"""Staff accounts, managed by the administrator only.

Nobody registers into the administration console: the administrator creates each staff
account, gives it a position (vəzifə) and ticks what it may do, and can change those
rights, reset the password or switch the account off later.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select

from app.core.deps import AdminUser, SessionDep
from app.core.errors import conflict, forbidden, not_found
from app.core.ratelimit import client_ip
from app.core.security import hash_password
from app.modules.audit import service as audit
from app.modules.identity import permissions as perms
from app.modules.identity.models import STAFF_ROLES, Role, User
from app.modules.identity.permissions import PERMISSION_LABELS, Permission
from app.modules.identity.service import normalise_email

router = APIRouter(prefix="/admin/users", tags=["admin: staff accounts"])


def _strong(value: str) -> str:
    if not any(c.isdigit() for c in value) or not any(c.isalpha() for c in value):
        raise ValueError("Şifrədə ən azı bir hərf və bir rəqəm olmalıdır")
    return value


class PermissionOut(BaseModel):
    code: Permission
    label: str
    description: str


class StaffOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    position: str | None
    permissions: list[Permission]  # effective
    custom_permissions: bool  # False: the role's defaults apply
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime


class StaffCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=3, max_length=200)
    position: str | None = Field(default=None, max_length=120)
    password: str = Field(min_length=8, max_length=128, description="Initial password")
    permissions: list[Permission] = Field(default_factory=list)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return _strong(value)


class StaffUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=200)
    position: str | None = Field(default=None, max_length=120)
    permissions: list[Permission] | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        return _strong(value)


def _out(user: User) -> StaffOut:
    return StaffOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        position=user.position,
        permissions=sorted(perms.effective(user)),
        custom_permissions=user.permissions is not None,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


async def _staff(session, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None or user.role not in STAFF_ROLES:
        raise not_found("İşçi tapılmadı")
    return user


def _ip(request: Request) -> str | None:
    return client_ip(request)


@router.get("/permissions", response_model=list[PermissionOut], summary="Permissions to grant")
async def permission_catalogue(_: AdminUser) -> list[PermissionOut]:
    return [
        PermissionOut(code=p, label=label, description=description)
        for p, (label, description) in PERMISSION_LABELS.items()
    ]


@router.get("", response_model=list[StaffOut], summary="Staff accounts")
async def list_staff(_: AdminUser, session: SessionDep) -> list[StaffOut]:
    users = (
        await session.scalars(
            select(User).where(User.role.in_(STAFF_ROLES)).order_by(User.created_at)
        )
    ).all()
    return [_out(u) for u in users]


@router.post(
    "",
    response_model=StaffOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a staff account",
)
async def create_staff(
    data: StaffCreate, admin: AdminUser, session: SessionDep, request: Request
) -> StaffOut:
    email = normalise_email(data.email)
    if await session.scalar(select(User.id).where(User.email == email)):
        raise conflict("email_taken", "Bu e-poçt ilə hesab artıq mövcuddur")
    user = User(
        email=email,
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip(),
        role=Role.STAFF,
        position=(data.position or "").strip() or None,
        permissions=sorted({p.value for p in data.permissions}),
    )
    session.add(user)
    await session.flush()
    audit.record(
        session,
        admin,
        "staff.create",
        "user",
        str(user.id),
        {"email": email, "position": user.position, "permissions": user.permissions},
        _ip(request),
    )
    await session.commit()
    await session.refresh(user)  # created_at and updated_at come from the database
    return _out(user)


@router.patch("/{user_id}", response_model=StaffOut, summary="Change position, rights or status")
async def update_staff(
    user_id: uuid.UUID, data: StaffUpdate, admin: AdminUser, session: SessionDep, request: Request
) -> StaffOut:
    user = await _staff(session, user_id)
    if user.role == Role.ADMIN and (data.permissions is not None or data.is_active is False):
        raise forbidden("Administratorun hüquqları və statusu dəyişdirilə bilməz")
    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if "position" in data.model_fields_set:
        user.position = (data.position or "").strip() or None
    if data.permissions is not None:
        user.permissions = sorted({p.value for p in data.permissions})
    if data.is_active is not None:
        user.is_active = data.is_active
    audit.record(
        session,
        admin,
        "staff.update",
        "user",
        str(user.id),
        data.model_dump(exclude_unset=True, mode="json"),
        _ip(request),
    )
    await session.commit()
    await session.refresh(user)  # created_at and updated_at come from the database
    return _out(user)


@router.post(
    "/{user_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Set a new password for a staff account",
)
async def reset_password(
    user_id: uuid.UUID, data: PasswordReset, admin: AdminUser, session: SessionDep, request: Request
) -> None:
    user = await _staff(session, user_id)
    user.password_hash = hash_password(data.password)
    user.failed_logins = 0
    user.locked_until = None
    audit.record(session, admin, "staff.password_reset", "user", str(user.id), None, _ip(request))
    await session.commit()

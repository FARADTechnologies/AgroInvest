"""Password hashing (Argon2id) and session tokens (short-lived signed JWT)."""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_hasher = PasswordHasher()  # Argon2id with the library's recommended parameters


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


# Used to spend the same time on unknown e-mails, so login timing does not reveal accounts.
_DUMMY_HASH = _hasher.hash("timing-equaliser")


def burn_verification_time(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def create_access_token(user_id: uuid.UUID, role: str) -> tuple[str, datetime]:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": str(user_id), "role": role, "exp": expires, "iat": datetime.now(UTC)}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires


def decode_access_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None

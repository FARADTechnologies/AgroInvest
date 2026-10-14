import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.modules.identity.models import Role

CONSENT_VERSION = "2026-10"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=3, max_length=200)
    consent: bool = Field(description="Consent to personal-data processing (required)")

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        if not any(c.isdigit() for c in value) or not any(c.isalpha() for c in value):
            raise ValueError("Şifrədə ən azı bir hərf və bir rəqəm olmalıdır")
        return value

    @field_validator("consent")
    @classmethod
    def consent_given(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Fərdi məlumatların emalına razılıq tələb olunur")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    has_profile: bool = False


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime

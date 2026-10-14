import re
import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.modules.entrepreneurs.models import EntrepreneurType

FIN_RE = re.compile(r"^[A-Z0-9]{7}$")
VOEN_RE = re.compile(r"^\d{10}$")
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{9,20}$")


class EntrepreneurIn(BaseModel):
    type: EntrepreneurType
    fin: str | None = Field(default=None, description="FİN: 7 Latin letters/digits (individual)")
    voen: str | None = Field(default=None, description="VÖEN: 10 digits (company)")
    full_name: str = Field(min_length=3, max_length=200)
    company_name: str | None = Field(default=None, max_length=250)
    legal_form: str | None = Field(default=None, max_length=60)
    phone: str
    email: EmailStr
    address: str | None = Field(default=None, max_length=300)
    is_local: bool = False
    origin_rayon_id: int | None = None

    @field_validator("fin")
    @classmethod
    def check_fin(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip().upper()
        if not FIN_RE.match(value):
            raise ValueError("FİN 7 simvoldan (latın hərfləri və rəqəmlər) ibarət olmalıdır")
        return value

    @field_validator("voen")
    @classmethod
    def check_voen(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        if not VOEN_RE.match(value):
            raise ValueError("VÖEN 10 rəqəmdən ibarət olmalıdır")
        return value

    @field_validator("phone")
    @classmethod
    def check_phone(cls, value: str) -> str:
        value = value.strip()
        if not PHONE_RE.match(value):
            raise ValueError("Telefon nömrəsi düzgün deyil")
        return value

    @model_validator(mode="after")
    def identifier_matches_type(self) -> "EntrepreneurIn":
        if self.type == EntrepreneurType.INDIVIDUAL:
            if not self.fin:
                raise ValueError("Fiziki şəxs üçün FİN tələb olunur")
            self.voen = self.voen or None
        else:
            if not self.voen:
                raise ValueError("Hüquqi şəxs üçün VÖEN tələb olunur")
            if not self.company_name:
                raise ValueError("Hüquqi şəxs üçün şirkətin adı tələb olunur")
        return self


class EntrepreneurOut(BaseModel):
    id: uuid.UUID
    type: EntrepreneurType
    fin: str | None
    voen: str | None
    full_name: str
    company_name: str | None
    legal_form: str | None
    phone: str
    email: str
    address: str | None
    is_local: bool
    origin_rayon_id: int | None
    ektis_farmer_id: str | None

    model_config = {"from_attributes": True}

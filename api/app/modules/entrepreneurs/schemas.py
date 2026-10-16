import re
import uuid
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.modules.areas.models import Purpose
from app.modules.entrepreneurs.models import Citizenship, EntrepreneurType

FIN_RE = re.compile(r"^[A-Z0-9]{7}$")
VOEN_RE = re.compile(r"^\d{10}$")
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{9,20}$")
PASSPORT_RE = re.compile(r"^[A-Z0-9]{5,20}$")


class EntrepreneurIn(BaseModel):
    type: EntrepreneurType
    citizenship: Citizenship = Field(
        default=Citizenship.AZ,
        description="AZ: Azerbaijani citizen (FİN); FOREIGN: passport number and country",
    )
    fin: str | None = Field(
        default=None, description="FİN: 7 Latin letters/digits (Azerbaijani citizen)"
    )
    passport_no: str | None = Field(default=None, description="Passport number (foreign citizen)")
    citizenship_country: str | None = Field(
        default=None, max_length=60, description="Country of citizenship (foreign citizen)"
    )
    voen: str | None = Field(default=None, description="VÖEN: 10 digits (company)")
    full_name: str = Field(min_length=3, max_length=200)
    company_name: str | None = Field(default=None, max_length=250)
    legal_form: str | None = Field(default=None, max_length=60)
    phone: str
    email: EmailStr
    address: str | None = Field(default=None, max_length=300)
    is_local: bool = False
    origin_rayon_id: int | None = None
    # Investors only: the catalogue filters listings by these.
    budget_azn: Decimal | None = Field(default=None, ge=0, le=10_000_000_000)
    interests: list[Purpose] | None = None

    @field_validator("fin")
    @classmethod
    def check_fin(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip().upper()
        if not FIN_RE.match(value):
            raise ValueError("FİN 7 simvoldan (latın hərfləri və rəqəmlər) ibarət olmalıdır")
        return value

    @field_validator("passport_no")
    @classmethod
    def check_passport(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.replace(" ", "").strip().upper()
        if not PASSPORT_RE.match(value):
            raise ValueError("Pasport nömrəsi 5–20 latın hərfi və rəqəmdən ibarət olmalıdır")
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
            if self.citizenship == Citizenship.FOREIGN:
                if not self.passport_no:
                    raise ValueError("Xarici vətəndaş üçün pasport nömrəsi tələb olunur")
                if not (self.citizenship_country or "").strip():
                    raise ValueError("Xarici vətəndaş üçün vətəndaşı olduğu ölkə tələb olunur")
                self.citizenship_country = (self.citizenship_country or "").strip()
                self.fin = None
            else:
                if not self.fin:
                    raise ValueError("Azərbaycan vətəndaşı üçün FİN tələb olunur")
                self.passport_no = None
                self.citizenship_country = None
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
    citizenship: Citizenship
    fin: str | None
    passport_no: str | None
    citizenship_country: str | None
    voen: str | None
    full_name: str
    company_name: str | None
    legal_form: str | None
    phone: str
    email: str
    address: str | None
    is_local: bool
    origin_rayon_id: int | None
    budget_azn: Decimal | None
    interests: list[Purpose] | None
    ektis_farmer_id: str | None

    model_config = {"from_attributes": True}

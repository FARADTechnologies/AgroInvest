import uuid
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import ARRAY, Boolean, CheckConstraint, ForeignKey, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.db.types import str_enum


class Citizenship(StrEnum):
    AZ = "AZ"  # Azərbaycan vətəndaşı, identified by FİN
    FOREIGN = "FOREIGN"  # xarici vətəndaş, identified by passport number and country


class EntrepreneurType(StrEnum):
    INDIVIDUAL = "INDIVIDUAL"  # fiziki şəxs: FİN, or passport for a foreign citizen
    COMPANY = "COMPANY"  # hüquqi şəxs, identified by VÖEN


def party_identifier(data: dict) -> tuple[str, str]:
    """Label and value of the identifier in a profile or its frozen copy on an application."""
    if data.get("type") == EntrepreneurType.COMPANY.value:
        return "VÖEN", data.get("voen") or ""
    if data.get("fin"):
        return "FİN", data["fin"]
    if data.get("passport_no"):
        return "Pasport", data["passport_no"]
    return "FİN", ""


class Entrepreneur(Base, TimestampMixin):
    """Identity of a portal user: a person (FİN, or passport for a foreign citizen) or a
    company (VÖEN).

    One per user account. Users also state their budget and the activities they look for;
    the catalogue filters by them.
    """

    __tablename__ = "entrepreneur"
    __table_args__ = (
        CheckConstraint(
            "(type = 'INDIVIDUAL' AND (fin IS NOT NULL OR passport_no IS NOT NULL))"
            " OR (type = 'COMPANY' AND voen IS NOT NULL)",
            name="identifier_matches_type",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), unique=True)
    type: Mapped[EntrepreneurType] = mapped_column(str_enum(EntrepreneurType))
    citizenship: Mapped[Citizenship] = mapped_column(
        str_enum(Citizenship), default=Citizenship.AZ, server_default=Citizenship.AZ.value
    )
    fin: Mapped[str | None] = mapped_column(String(7))
    passport_no: Mapped[str | None] = mapped_column(String(20))
    citizenship_country: Mapped[str | None] = mapped_column(String(60))
    voen: Mapped[str | None] = mapped_column(String(10))
    full_name: Mapped[str] = mapped_column(String(200))  # person, or company representative
    company_name: Mapped[str | None] = mapped_column(String(250))
    legal_form: Mapped[str | None] = mapped_column(String(60))
    phone: Mapped[str] = mapped_column(String(30))
    email: Mapped[str] = mapped_column(String(254))
    address: Mapped[str | None] = mapped_column(String(300))
    # "Yerli sahibkar": registered in, or originally from, the region.
    is_local: Mapped[bool] = mapped_column(Boolean, default=False)
    origin_rayon_id: Mapped[int | None] = mapped_column(ForeignKey("rayon.id"))
    # Set when the EKTIS farmer registry lookup finds this person or company.
    ektis_farmer_id: Mapped[str | None] = mapped_column(String(40))
    budget_azn: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    interests: Mapped[list[str] | None] = mapped_column(ARRAY(String(16)))

    @property
    def identifier(self) -> tuple[str, str]:
        return party_identifier(
            {
                "type": self.type.value,
                "fin": self.fin,
                "voen": self.voen,
                "passport_no": self.passport_no,
            }
        )

    @property
    def display_name(self) -> str:
        return self.company_name or self.full_name

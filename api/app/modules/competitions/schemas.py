import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.modules.areas.models import Purpose
from app.modules.competitions.models import CompetitionStatus


class LotInput(BaseModel):
    farm_area_id: uuid.UUID
    min_investment_azn: Decimal | None = Field(default=None, ge=0)


class RequiredDocInput(BaseModel):
    code: str
    mandatory: bool = True


class CompetitionInput(BaseModel):
    title_az: str = Field(min_length=5, max_length=300)
    description_az: str = Field(min_length=5, max_length=3000)
    conditions_az: str = Field(min_length=5, max_length=5000)
    opens_at: datetime
    deadline_at: datetime
    lots: list[LotInput] = Field(min_length=1, max_length=50)
    required_documents: list[RequiredDocInput] = Field(min_length=1)

    @model_validator(mode="after")
    def dates_in_order(self) -> "CompetitionInput":
        if self.deadline_at <= self.opens_at:
            raise ValueError("Son müraciət tarixi qəbulun başlanma tarixindən sonra olmalıdır")
        if len({lot.farm_area_id for lot in self.lots}) != len(self.lots):
            raise ValueError("Eyni sahə bir müsabiqəyə iki dəfə əlavə edilə bilməz")
        return self


class ReviewDecision(BaseModel):
    comment: str | None = Field(default=None, max_length=2000)


class LotResult(BaseModel):
    farm_area_id: uuid.UUID
    winner_application_id: uuid.UUID
    reason_winner: str = Field(min_length=3, max_length=3000)
    reason_others: str = Field(min_length=3, max_length=3000)


class AdminLot(BaseModel):
    lot_no: int
    farm_area_id: uuid.UUID
    code: str
    name_az: str
    rayon_name: str
    area_ha: Decimal
    purpose: Purpose
    min_investment_azn: Decimal | None
    applications: int
    winner_number: str | None


class AdminCompetition(BaseModel):
    id: uuid.UUID
    number: str
    title_az: str
    description_az: str
    conditions_az: str
    status: CompetitionStatus
    is_open: bool
    opens_at: datetime
    deadline_at: datetime
    created_by_name: str
    created_by_id: uuid.UUID
    submitted_at: datetime | None
    approved_by_name: str | None
    approved_at: datetime | None
    review_comment: str | None
    published_at: datetime | None
    lots: list[AdminLot]
    required_documents: list[RequiredDocInput]
    application_count: int
    total_ha: Decimal
    can_edit: bool
    can_submit: bool
    can_review: bool


class AdminCompetitionList(BaseModel):
    items: list[AdminCompetition]
    status_counts: dict[str, int]

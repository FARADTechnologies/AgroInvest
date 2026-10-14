import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel

from app.modules.areas.models import (
    AreaStatus,
    DataSource,
    DeminingStatus,
    FaoClass,
    Irrigation,
    Purpose,
)


class AreaSort(StrEnum):
    DEADLINE = "deadline"
    AREA_DESC = "area_desc"
    AREA_ASC = "area_asc"
    CODE = "code"


class CompetitionRef(BaseModel):
    id: uuid.UUID
    number: str
    title_az: str
    deadline_at: datetime
    is_open: bool


class SuitabilityOut(BaseModel):
    activity: Purpose
    score: int
    fao_class: FaoClass
    constraint_reason: str | None
    factors: dict


class AreaListItem(BaseModel):
    id: uuid.UUID
    code: str
    name_az: str
    rayon_id: int
    rayon_name: str
    region_code: str
    village_name: str | None
    area_ha: Decimal
    purpose: Purpose
    status: AreaStatus
    irrigation: Irrigation
    demining_status: DeminingStatus
    data_source: DataSource
    centroid: tuple[float, float]
    competition: CompetitionRef | None
    best_fao_class: FaoClass | None = None


class AreaPage(BaseModel):
    items: list[AreaListItem]
    total: int
    page: int
    size: int
    purpose_counts: dict[str, int]


class RequiredDocOut(BaseModel):
    code: str
    name_az: str
    description_az: str | None
    applies_to: str
    mandatory: bool


class AreaDetail(AreaListItem):
    conditions_of_use: str
    lease_term_years: int
    annual_fee_azn_per_ha: Decimal | None
    soil_type: str | None
    dist_water_m: int | None
    dist_road_m: int | None
    dist_village_m: int | None
    elevation_m: int | None
    slope_deg: Decimal | None
    demining_certified_on: date | None
    geometry: dict
    min_investment_azn: Decimal | None
    required_documents: list[RequiredDocOut]
    suitability: list[SuitabilityOut]

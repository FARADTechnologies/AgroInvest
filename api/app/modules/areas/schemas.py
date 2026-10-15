import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

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
    centroid: list[float]  # [lon, lat]
    competition: CompetitionRef | None
    best_fao_class: FaoClass | None = None
    annual_fee_azn_per_ha: Decimal | None = None
    # Minimum investment of the area's lot in the competition shown above.
    min_investment_azn: Decimal | None = None


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
    soil_type: str | None
    dist_water_m: int | None
    dist_road_m: int | None
    dist_village_m: int | None
    elevation_m: int | None
    slope_deg: Decimal | None
    demining_certified_on: date | None
    geometry: dict
    required_documents: list[RequiredDocOut]
    suitability: list[SuitabilityOut]


# ── Compare: decision support (TOPSIS) ─────────────────────────────────────


class RankRequest(BaseModel):
    codes: list[str] = Field(min_length=2, max_length=3)
    activity: Literal["CROP", "ORCHARD", "LIVESTOCK", "OTHER"]
    preset: Literal["balanced", "suitability", "cost", "access"] | None = None
    # Importance per criterion (0–10); ignored when a preset is given.
    weights: dict[str, float] | None = None


class CriterionValue(BaseModel):
    raw: float | None
    display: str
    score: float | None  # 1 = best of the compared plots, 0 = worst
    best: bool
    imputed: bool


class CriterionOut(BaseModel):
    key: str
    label: str
    unit: str
    benefit: bool
    weight: float
    values: dict[str, CriterionValue]


class RankedArea(BaseModel):
    code: str
    name_az: str
    rank: int | None
    closeness: float | None
    excluded_reason: str | None = None


class RankOut(BaseModel):
    method: str = "TOPSIS"
    activity: str
    weights: dict[str, float]
    ranking: list[RankedArea]
    criteria: list[CriterionOut]
    explanation: list[str]
    stability: float  # share of perturbed-weight runs that keep the same first place
    stable: bool
    note: str

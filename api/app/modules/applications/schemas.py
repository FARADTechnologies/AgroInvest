import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.modules.applications.models import ApplicationStatus, Outcome
from app.modules.areas.models import Purpose
from app.modules.entrepreneurs.models import EntrepreneurType


class CreateApplication(BaseModel):
    area_code: str = Field(description="Farm area code, e.g. AGM-0042")


class BusinessPlanData(BaseModel):
    investment_azn: Decimal | None = Field(default=None, ge=0, le=Decimal("1000000000"))
    own_funds_pct: Decimal | None = Field(default=None, ge=0, le=100)
    jobs_planned: int | None = Field(default=None, ge=0, le=100000)
    jobs_local: int | None = Field(default=None, ge=0, le=100000)
    implementation_months: int | None = Field(default=None, ge=1, le=240)
    experience_years: int | None = Field(default=None, ge=0, le=80)
    summary: str | None = Field(default=None, max_length=3000)
    products_market: str | None = Field(default=None, max_length=3000)
    technology: str | None = Field(default=None, max_length=3000)
    water_plan: str | None = Field(default=None, max_length=3000)


class UpdateApplication(BaseModel):
    activity: Purpose | None = None
    project_title: str | None = Field(default=None, max_length=200)
    business_plan: BusinessPlanData | None = None


class InfoResponse(BaseModel):
    response_text: str = Field(min_length=3, max_length=3000)


class TransitionRequest(BaseModel):
    to: ApplicationStatus
    reason: str | None = Field(default=None, max_length=3000)
    outcome: Outcome | None = None
    requested_doc_types: list[str] = Field(default_factory=list)
    expected_version: int | None = Field(
        default=None,
        description="Rejects the change if someone else changed the application meanwhile",
    )


class ApplicantOut(BaseModel):
    type: EntrepreneurType
    display_name: str
    full_name: str
    company_name: str | None
    identifier_label: str
    identifier: str
    identifier_masked: bool
    phone: str
    email: str
    address: str | None
    is_local: bool
    origin_rayon_name: str | None
    ektis_farmer_id: str | None


class AreaRef(BaseModel):
    id: uuid.UUID
    code: str
    name_az: str
    rayon_name: str
    village_name: str | None
    area_ha: Decimal
    purpose: Purpose


class CompetitionRef(BaseModel):
    id: uuid.UUID
    number: str
    title_az: str
    deadline_at: datetime
    is_open: bool


class DocumentOut(BaseModel):
    id: uuid.UUID
    doc_type_code: str
    doc_type_name: str
    original_name: str
    mime: str
    size_bytes: int
    version: int
    uploaded_at: datetime
    info_request_id: uuid.UUID | None


class RequiredDocStatus(BaseModel):
    code: str
    name_az: str
    description_az: str | None
    mandatory: bool
    max_mb: int
    document: DocumentOut | None


class HistoryOut(BaseModel):
    from_status: ApplicationStatus | None
    to_status: ApplicationStatus
    outcome: Outcome | None
    actor_label: str
    reason: str | None
    created_at: datetime


class InfoRequestOut(BaseModel):
    id: uuid.UUID
    message: str
    requested_docs: list[dict]
    created_at: datetime
    responded_at: datetime | None
    response_text: str | None


class Completeness(BaseModel):
    profile: bool
    activity: bool
    business_plan: bool
    documents: bool
    missing: list[str]


class ApplicationOut(BaseModel):
    id: uuid.UUID
    number: str | None
    status: ApplicationStatus
    outcome: Outcome | None
    decision_reason: str | None
    decided_at: datetime | None
    submitted_at: datetime | None
    created_at: datetime
    last_status_at: datetime
    version: int
    activity: Purpose
    project_title: str | None
    applicant: ApplicantOut | None
    area: AreaRef
    competition: CompetitionRef
    min_investment_azn: Decimal | None
    business_plan: BusinessPlanData
    documents: list[DocumentOut]
    required_documents: list[RequiredDocStatus]
    history: list[HistoryOut]
    info_request: InfoRequestOut | None
    completeness: Completeness
    allowed_transitions: list[ApplicationStatus]


class ApplicationSummary(BaseModel):
    id: uuid.UUID
    number: str | None
    status: ApplicationStatus
    outcome: Outcome | None
    area_code: str
    area_name: str
    rayon_name: str
    purpose: Purpose
    area_ha: Decimal
    competition_number: str
    deadline_at: datetime
    submitted_at: datetime | None
    last_status_at: datetime
    investment_azn: Decimal | None
    jobs_planned: int | None
    applicant_name: str | None = None
    applicant_identifier: str | None = None


class AdminApplicationPage(BaseModel):
    items: list[ApplicationSummary]
    total: int
    page: int
    size: int
    status_counts: dict[str, int]

import uuid
from datetime import date
from decimal import Decimal
from enum import StrEnum

from geoalchemy2 import Geometry
from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.types import str_enum
from app.modules.geo.models import Rayon, Village


class Purpose(StrEnum):
    """Designated purpose (təyinat) of a farm area."""

    CROP = "CROP"  # Əkinçilik
    LIVESTOCK = "LIVESTOCK"  # Heyvandarlıq
    ORCHARD = "ORCHARD"  # Bağçılıq
    OTHER = "OTHER"  # Digər


class Irrigation(StrEnum):
    NONE = "NONE"
    CANAL = "CANAL"
    WELL = "WELL"
    RIVER = "RIVER"


class DeminingStatus(StrEnum):
    CLEARED = "CLEARED"
    IN_PROGRESS = "IN_PROGRESS"
    NOT_SURVEYED = "NOT_SURVEYED"


class AreaStatus(StrEnum):
    DRAFT = "DRAFT"
    AVAILABLE = "AVAILABLE"
    IN_COMPETITION = "IN_COMPETITION"
    ALLOCATED = "ALLOCATED"
    WITHDRAWN = "WITHDRAWN"


class DataSource(StrEnum):
    OSM = "OSM"  # polygon traced from OpenStreetMap farmland
    SYNTHETIC = "SYNTHETIC"  # generated for the demo where OSM coverage is thin
    MANUAL = "MANUAL"  # entered by a specialist
    EKTIS = "EKTIS"  # imported from the EKTIS parcel registry


class FaoClass(StrEnum):
    S1 = "S1"
    S2 = "S2"
    S3 = "S3"
    N = "N"


class FarmArea(Base, TimestampMixin):
    """Təsərrüfat sahəsi: a plot of state land that can be offered in a competition."""

    __tablename__ = "farm_area"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True)  # e.g. AGM-0042
    name_az: Mapped[str] = mapped_column(String(200))
    rayon_id: Mapped[int] = mapped_column(ForeignKey("rayon.id"))
    village_id: Mapped[int | None] = mapped_column(ForeignKey("village.id"))
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    centroid = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    # Computed from the geometry on the server; never typed in.
    area_ha: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    purpose: Mapped[Purpose] = mapped_column(str_enum(Purpose))

    conditions_of_use: Mapped[str] = mapped_column(Text)  # istifadə şərtləri
    lease_term_years: Mapped[int] = mapped_column(Integer)
    annual_fee_azn_per_ha: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    irrigation: Mapped[Irrigation] = mapped_column(str_enum(Irrigation))
    soil_type: Mapped[str | None] = mapped_column(String(120))

    dist_water_m: Mapped[int | None] = mapped_column(Integer)
    dist_road_m: Mapped[int | None] = mapped_column(Integer)
    dist_village_m: Mapped[int | None] = mapped_column(Integer)
    elevation_m: Mapped[int | None] = mapped_column(Integer)
    slope_deg: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))

    demining_status: Mapped[DeminingStatus] = mapped_column(str_enum(DeminingStatus))
    demining_certified_on: Mapped[date | None] = mapped_column(Date)

    status: Mapped[AreaStatus] = mapped_column(str_enum(AreaStatus))
    data_source: Mapped[DataSource] = mapped_column(str_enum(DataSource))
    ektis_parcel_ref: Mapped[str | None] = mapped_column(String(40))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))

    rayon: Mapped[Rayon] = relationship(lazy="joined")
    village: Mapped[Village | None] = relationship(lazy="joined")


class AreaSuitability(Base):
    """Decision-support score of an area for one activity (GIS MCDA, FAO classes)."""

    __tablename__ = "area_suitability"

    farm_area_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("farm_area.id", ondelete="CASCADE"), primary_key=True
    )
    activity: Mapped[Purpose] = mapped_column(str_enum(Purpose), primary_key=True)
    method_version: Mapped[str] = mapped_column(String(20), primary_key=True)
    score: Mapped[int] = mapped_column(Integer)  # 0-100
    fao_class: Mapped[FaoClass] = mapped_column(str_enum(FaoClass, 4))
    constraint_reason: Mapped[str | None] = mapped_column(String(200))
    # Per factor: raw value, membership 0-1, AHP weight.
    factors: Mapped[dict] = mapped_column(JSONB, default=dict)

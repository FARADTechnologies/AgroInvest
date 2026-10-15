from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Region(Base):
    """Economic region, e.g. Qarabağ or Şərqi Zəngəzur."""

    __tablename__ = "region"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name_az: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))


class Rayon(Base):
    __tablename__ = "rayon"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    region_id: Mapped[int] = mapped_column(ForeignKey("region.id"))
    iso_code: Mapped[str] = mapped_column(String(8), unique=True)  # e.g. AZ-AGM
    short_code: Mapped[str] = mapped_column(String(4), unique=True)  # e.g. AGM, used in area codes
    name_az: Mapped[str] = mapped_column(String(120))
    name_en: Mapped[str] = mapped_column(String(120))
    label_az: Mapped[str] = mapped_column(String(120))  # e.g. "Ağdam rayonu", "Xankəndi şəhəri"
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)

    region: Mapped[Region] = relationship(lazy="joined")


class Village(Base):
    """Settlement with a curated Azerbaijani name. OSM `name` is never used."""

    __tablename__ = "village"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rayon_id: Mapped[int] = mapped_column(ForeignKey("rayon.id"))
    name_az: Mapped[str] = mapped_column(String(120))
    geom = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    osm_id: Mapped[int | None] = mapped_column(BigInteger)


class CountryOutline(Base):
    """Azerbaijan's land outline; the map masks everything outside it."""

    __tablename__ = "country_outline"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)


class GeoFeature(Base):
    """Reference lines and polygons from OpenStreetMap that suitability distances are
    measured to: main roads and water (rivers, canals, streams, lakes, reservoirs)."""

    __tablename__ = "geo_feature"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(10), index=True)  # ROAD | WATER
    subtype: Mapped[str] = mapped_column(String(20))  # primary, river, canal, reservoir…
    geom = mapped_column(Geometry("GEOMETRY", srid=4326), nullable=False)


class WaterBody(Base):
    """Large water drawn by the map itself (the Caspian Sea), so the shoreline
    is right even when the online basemap is unavailable."""

    __tablename__ = "water_body"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(20))
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)

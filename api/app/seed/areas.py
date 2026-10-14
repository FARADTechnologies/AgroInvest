"""Farm areas built by the geo pipeline, enriched with demo terms of use.

Everything here is demo data. Lease terms and conditions are illustrative and
are replaced by the researched values when they are available.
"""

import hashlib
from datetime import date
from decimal import Decimal
from pathlib import Path

from geoalchemy2.shape import from_shape
from shapely.geometry import shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.areas.models import (
    AreaStatus,
    DataSource,
    DeminingStatus,
    FarmArea,
    Irrigation,
    Purpose,
)
from app.modules.geo.models import Rayon, Village
from app.seed.reference import as_multi, read_geojson

NOUN = {
    Purpose.CROP: "əkin sahəsi",
    Purpose.ORCHARD: "bağ sahəsi",
    Purpose.LIVESTOCK: "otlaq sahəsi",
    Purpose.OTHER: "təsərrüfat sahəsi",
}

LEASE_YEARS = {Purpose.CROP: 25, Purpose.ORCHARD: 30, Purpose.LIVESTOCK: 15, Purpose.OTHER: 20}
FEE_PER_HA = {Purpose.CROP: 28, Purpose.ORCHARD: 35, Purpose.LIVESTOCK: 12, Purpose.OTHER: 60}

CONDITIONS = {
    Purpose.CROP: (
        "Sahə yalnız kənd təsərrüfatı təyinatı üzrə, əkinçilik məqsədilə istifadə olunur. "
        "İcarə müddəti {years} ildir. İcarəçi ilk iki il ərzində sahənin ən azı 70 faizini əkinə cəlb "
        "etməli, torpağın münbitliyini qorumalı və suvarma infrastrukturunu öz hesabına bərpa etməlidir. "
        "Sahənin təyinatının dəyişdirilməsi və subicarəyə verilməsi qadağandır."
    ),
    Purpose.ORCHARD: (
        "Sahə çoxillik əkmələr (meyvə bağı, üzümlük) salınması üçün verilir. İcarə müddəti {years} ildir. "
        "Bağ ilk üç il ərzində salınmalı, sertifikatlı tinglərdən istifadə edilməli və damcı suvarma "
        "sistemi qurulmalıdır. Sahənin təyinatının dəyişdirilməsi qadağandır."
    ),
    Purpose.LIVESTOCK: (
        "Sahə otlaq və heyvandarlıq təsərrüfatı üçün verilir. İcarə müddəti {years} ildir. "
        "Otlaq yükü normalara uyğun olmalı, eroziyanın qarşısı alınmalıdır. Mövsümi tövlə və su "
        "nöqtələri yalnız razılaşdırılmış layihə əsasında tikilə bilər."
    ),
    Purpose.OTHER: (
        "Sahə istixana təsərrüfatı və ya kənd təsərrüfatı məhsullarının ilkin emalı üçün verilir. "
        "İcarə müddəti {years} ildir. Tikinti işləri layihə razılaşdırıldıqdan sonra aparılır, "
        "yerli işçi qüvvəsinin cəlb edilməsi üstünlük sayılır."
    ),
}

SOIL = {
    "lowland": ["Boz-qəhvəyi torpaq", "Çəmən-boz torpaq", "Boz-çəmən torpaq"],
    "foothill": ["Şabalıdı torpaq", "Dağ-qəhvəyi torpaq"],
    "mountain": ["Dağ-çəmən torpaq", "Dağ-qəhvəyi torpaq"],
}
TERRAIN = {
    "AZ-AGC": "lowland",
    "AZ-BAR": "lowland",
    "AZ-AGM": "lowland",
    "AZ-TAR": "lowland",
    "AZ-FUZ": "lowland",
    "AZ-CAB": "lowland",
    "AZ-ZAN": "lowland",
    "AZ-XCI": "foothill",
    "AZ-XVD": "foothill",
    "AZ-QBI": "foothill",
    "AZ-XA": "foothill",
    "AZ-SUS": "mountain",
    "AZ-LAC": "mountain",
    "AZ-KAL": "mountain",
}

# A few areas are still being cleared of mines: they appear on the map but cannot be
# put into a competition until they are certified (demo data, not real survey data).
DEMINING_IN_PROGRESS = {"AGM-0002", "FUZ-0003", "XVD-0004", "LAC-0003"}


def _pick(code: str, options: list, salt: str = ""):
    digest = hashlib.sha256(f"{code}{salt}".encode()).digest()
    return options[digest[0] % len(options)]


async def load_areas(
    session: AsyncSession, seed_dir: Path, rayons: dict[str, Rayon]
) -> list[FarmArea]:
    village_ids = {
        (rayon_id, name): vid
        for vid, rayon_id, name in (
            await session.execute(select(Village.id, Village.rayon_id, Village.name_az))
        ).all()
    }
    areas = []
    for f in read_geojson(seed_dir / "geo" / "farm_areas.geojson"):
        p = f["properties"]
        rayon = rayons[p["iso_code"]]
        purpose = Purpose(p["purpose"])
        code = p["code"]
        geom = as_multi(shape(f["geometry"]))
        village_name = p.get("village_name")
        name = (
            f"{village_name} {NOUN[purpose]}"
            if village_name
            else f"{rayon.name_az} {NOUN[purpose]}"
        )
        irrigation = (
            Irrigation.NONE
            if purpose == Purpose.LIVESTOCK
            else _pick(
                code,
                [
                    Irrigation.CANAL,
                    Irrigation.CANAL,
                    Irrigation.RIVER,
                    Irrigation.WELL,
                    Irrigation.NONE,
                ],
            )
        )
        in_progress = code in DEMINING_IN_PROGRESS
        area = FarmArea(
            code=code,
            name_az=name,
            rayon_id=rayon.id,
            village_id=village_ids.get((rayon.id, village_name)),
            geom=from_shape(geom, srid=4326),
            centroid=from_shape(geom.representative_point(), srid=4326),
            area_ha=Decimal(str(p["area_ha"])),
            purpose=purpose,
            conditions_of_use=CONDITIONS[purpose].format(years=LEASE_YEARS[purpose]),
            lease_term_years=LEASE_YEARS[purpose],
            annual_fee_azn_per_ha=Decimal(FEE_PER_HA[purpose]),
            irrigation=irrigation,
            soil_type=_pick(code, SOIL[TERRAIN.get(p["iso_code"], "lowland")], "soil"),
            dist_village_m=int(p["dist_village_m"])
            if p.get("dist_village_m") is not None
            else None,
            demining_status=DeminingStatus.IN_PROGRESS if in_progress else DeminingStatus.CLEARED,
            demining_certified_on=None
            if in_progress
            else date(2025, 3 + (sum(map(ord, code)) % 9), 15),
            status=AreaStatus.AVAILABLE,
            data_source=DataSource(p["data_source"]),
        )
        session.add(area)
        areas.append(area)
    await session.flush()
    return areas

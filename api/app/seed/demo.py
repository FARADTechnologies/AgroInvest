"""Demo accounts and competitions. Every person and company here is fictional."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import hash_password
from app.modules.areas.models import AreaStatus, DeminingStatus, FarmArea, Purpose
from app.modules.competitions.models import (
    Competition,
    CompetitionArea,
    CompetitionRequiredDoc,
    CompetitionStatus,
)
from app.modules.entrepreneurs.models import Entrepreneur, EntrepreneurType
from app.modules.identity.models import Role, User

DEMO_DOMAIN = "agro-demo.test"  # reserved TLD: these addresses can never receive mail


@dataclass
class DemoPeople:
    admin: User
    specialist: User
    supervisor: User
    entrepreneur: User
    applicants: list[tuple[User, Entrepreneur]]


def _user(email: str, name: str, role: Role, password_hash: str) -> User:
    return User(
        email=f"{email}@{DEMO_DOMAIN}",
        full_name=name,
        role=role,
        password_hash=password_hash,
        consent_at=datetime.now(UTC) if role == Role.ENTREPRENEUR else None,
        consent_version="2026-10" if role == Role.ENTREPRENEUR else None,
    )


# Fictional applicants used to populate the review queue and statistics.
APPLICANTS = [
    (
        "arazaqro",
        "Elvin Məmmədov",
        EntrepreneurType.COMPANY,
        "Araz Aqro MMC",
        "1403567821",
        None,
        True,
    ),
    (
        "qarabagbaglari",
        "Günay Əliyeva",
        EntrepreneurType.COMPANY,
        "Qarabağ Bağları MMC",
        "1702348815",
        None,
        True,
    ),
    (
        "yaylaq",
        "Rəşad Hüseynov",
        EntrepreneurType.COMPANY,
        "Kəlbəcər Yaylaq MMC",
        "2004119836",
        None,
        False,
    ),
    ("sabina", "Səbinə Quliyeva", EntrepreneurType.INDIVIDUAL, None, None, "5KQ7M2D", True),
    ("orxan", "Orxan Nəsirov", EntrepreneurType.INDIVIDUAL, None, None, "6ZL3P9T", False),
    (
        "xudaferin",
        "Kamran Bağırov",
        EntrepreneurType.COMPANY,
        "Xudafərin Fermer Təsərrüfatı MMC",
        "1508723344",
        None,
        True,
    ),
]


async def load_people(session: AsyncSession, rayon_ids: list[int]) -> DemoPeople:
    pw = hash_password(get_settings().demo_password)
    admin = _user("admin", "Sistem administratoru", Role.ADMIN, pw)
    specialist = _user("mutexessis", "Leyla Kərimova", Role.SPECIALIST, pw)
    supervisor = _user("rehber", "Tural Abbasov", Role.SUPERVISOR, pw)
    entrepreneur = _user("sahibkar", "Nicat Rzayev", Role.ENTREPRENEUR, pw)
    session.add_all([admin, specialist, supervisor, entrepreneur])
    await session.flush()

    session.add(
        Entrepreneur(
            user_id=entrepreneur.id,
            type=EntrepreneurType.COMPANY,
            voen="1905832207",
            full_name="Nicat Rzayev",
            company_name="Yaşıl Vadi Aqro MMC",
            legal_form="MMC",
            phone="+994 50 555 01 23",
            email=entrepreneur.email,
            address="Bakı şəhəri, Nəsimi rayonu",
            is_local=False,
        )
    )

    applicants = []
    for i, (login, name, etype, company, voen, fin, local) in enumerate(APPLICANTS):
        user = _user(login, name, Role.ENTREPRENEUR, pw)
        session.add(user)
        await session.flush()
        profile = Entrepreneur(
            user_id=user.id,
            type=etype,
            voen=voen,
            fin=fin,
            full_name=name,
            company_name=company,
            legal_form="MMC" if company else None,
            phone=f"+994 55 300 {10 + i:02d} {40 + i:02d}",
            email=user.email,
            is_local=local,
            origin_rayon_id=rayon_ids[i % len(rayon_ids)] if local else None,
        )
        session.add(profile)
        applicants.append((user, profile))
    await session.flush()
    return DemoPeople(admin, specialist, supervisor, entrepreneur, applicants)


MIN_INVESTMENT_PER_HA = {
    Purpose.CROP: 2500,
    Purpose.ORCHARD: 6000,
    Purpose.LIVESTOCK: 1500,
    Purpose.OTHER: 40000,
}

STANDARD_DOCS = [
    ("BUSINESS_PLAN", True),
    ("FINANCIAL_CAPACITY", True),
    ("TAX_CLEARANCE", True),
    ("ID_CARD", True),
    ("VOEN_CERT", True),
    ("REGISTRY_EXTRACT", True),
    ("EXPERIENCE", False),
]


async def next_competition_number(session: AsyncSession, year: int) -> str:
    seq = await session.scalar(text("SELECT nextval('competition_number_seq')"))
    return f"MS-{year}-{seq:03d}"


def _min_investment(area: FarmArea) -> Decimal:
    raw = Decimal(area.area_ha) * MIN_INVESTMENT_PER_HA[area.purpose]
    return (raw / 10_000).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * 10_000 or Decimal(10_000)


async def load_competitions(
    session: AsyncSession, people: DemoPeople, areas: list[FarmArea], rayon_iso: dict[int, str]
) -> list[Competition]:
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    cleared = [a for a in areas if a.demining_status == DeminingStatus.CLEARED]

    def pick(isos: set[str], purposes: set[Purpose], limit: int) -> list[FarmArea]:
        chosen = [
            a
            for a in cleared
            if rayon_iso[a.rayon_id] in isos
            and a.purpose in purposes
            and a.status == AreaStatus.AVAILABLE
        ]
        return chosen[:limit]

    # Deadlines are relative to the moment the seed runs, so the demo never expires.
    plans = [
        (
            "Ağdam, Füzuli və Tərtər rayonlarında əkinçilik sahələri",
            "Dənli, texniki və yem bitkiləri üçün suvarılan əkin sahələri müsabiqəyə çıxarılır.",
            pick({"AZ-AGM", "AZ-FUZ", "AZ-TAR", "AZ-AGC", "AZ-BAR"}, {Purpose.CROP}, 10),
            now - timedelta(days=12),
            now + timedelta(days=21),
            CompetitionStatus.PUBLISHED,
        ),
        (
            "Zəngilan, Qubadlı və Cəbrayıl: bağçılıq və əkinçilik",
            "Araz vadisində meyvə bağları və əkinçilik üçün sahələr. Yerli sahibkarların iştirakı təşviq olunur.",
            pick({"AZ-ZAN", "AZ-QBI", "AZ-CAB"}, {Purpose.ORCHARD, Purpose.CROP}, 9),
            now - timedelta(days=20),
            now + timedelta(days=9),
            CompetitionStatus.PUBLISHED,
        ),
        (
            "Dağlıq ərazilərdə heyvandarlıq: yay otlaqları",
            "Kəlbəcər, Laçın və Şuşa rayonlarında yay otlaqları və heyvandarlıq təsərrüfatları üçün sahələr.",
            pick({"AZ-KAL", "AZ-LAC", "AZ-SUS", "AZ-XCI", "AZ-XVD"}, {Purpose.LIVESTOCK}, 8),
            now - timedelta(days=3),
            now + timedelta(days=30),
            CompetitionStatus.PUBLISHED,
        ),
        (
            "Xocalı və Xocavənd: meyvəçilik və üzümçülük",
            "Dağətəyi zonada intensiv bağlar və üzümlüklər üçün sahələr. Qəbul müddəti başa çatıb, müraciətlərə baxılır.",
            pick({"AZ-XCI", "AZ-XVD"}, {Purpose.ORCHARD, Purpose.CROP}, 6),
            now - timedelta(days=45),
            now - timedelta(days=6),
            CompetitionStatus.CLOSED,
        ),
    ]
    conditions = (
        "Müsabiqədə fiziki və hüquqi şəxslər iştirak edə bilər. Hər sahə üzrə qalib investisiya həcmi, "
        "yaradılacaq iş yerləri, təcrübə və biznes planın keyfiyyəti əsasında müəyyən edilir. Yekun qərar "
        "müsabiqə komissiyası tərəfindən verilir. Qalib sahibkar ilə icarə müqaviləsi bağlanır."
    )
    competitions = []
    for title, description, lots, opens, deadline, status in plans:
        comp = Competition(
            number=await next_competition_number(session, now.year),
            title_az=title,
            description_az=description,
            conditions_az=conditions,
            opens_at=opens,
            deadline_at=deadline,
            status=status,
            created_by=people.specialist.id,
            submitted_at=opens - timedelta(days=2),
            approved_by=people.supervisor.id,
            approved_at=opens - timedelta(days=1),
            review_comment="Şərtlər və sahələr yoxlanıldı, dərc edilməsi təsdiq olunur.",
            published_at=opens,
        )
        for lot_no, area in enumerate(lots, start=1):
            comp.areas.append(
                CompetitionArea(
                    farm_area_id=area.id, lot_no=lot_no, min_investment_azn=_min_investment(area)
                )
            )
            area.status = AreaStatus.IN_COMPETITION
        for code, mandatory in STANDARD_DOCS:
            comp.required_documents.append(
                CompetitionRequiredDoc(doc_type_code=code, mandatory=mandatory)
            )
        session.add(comp)
        competitions.append(comp)
    await session.flush()
    return competitions

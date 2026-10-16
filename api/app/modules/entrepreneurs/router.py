from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import PartyUser, SessionDep
from app.core.errors import not_found
from app.modules.entrepreneurs.models import Entrepreneur
from app.modules.entrepreneurs.schemas import EntrepreneurIn, EntrepreneurOut

router = APIRouter(prefix="/me/entrepreneur", tags=["entrepreneur profile"])


@router.get("", response_model=EntrepreneurOut)
async def get_profile(user: PartyUser, session: SessionDep) -> Entrepreneur:
    profile = await session.scalar(select(Entrepreneur).where(Entrepreneur.user_id == user.id))
    if profile is None:
        raise not_found("Profil hələ yaradılmayıb")
    return profile


@router.put("", response_model=EntrepreneurOut)
async def upsert_profile(
    data: EntrepreneurIn, user: PartyUser, session: SessionDep
) -> Entrepreneur:
    """Creates or updates the user's profile: FİN (Azerbaijani citizen) or passport (foreign
    citizen) for a person, VÖEN for a company.

    Submitted applications keep their own frozen copy, so editing here never
    changes an application that is already under review.
    """
    values = data.model_dump()
    profile = await session.scalar(select(Entrepreneur).where(Entrepreneur.user_id == user.id))
    if profile is None:
        profile = Entrepreneur(user_id=user.id, **values)
        session.add(profile)
    else:
        before = (profile.fin, profile.voen, profile.passport_no)
        for key, value in values.items():
            setattr(profile, key, value)
        if (profile.fin, profile.voen, profile.passport_no) != before:
            profile.ektis_farmer_id = None  # an EKTIS match belongs to the old identifier
    await session.commit()
    await session.refresh(profile)
    return profile

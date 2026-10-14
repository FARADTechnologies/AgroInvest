from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import EntrepreneurUser, SessionDep
from app.core.errors import not_found
from app.modules.entrepreneurs.models import Entrepreneur
from app.modules.entrepreneurs.schemas import EntrepreneurIn, EntrepreneurOut

router = APIRouter(prefix="/me/entrepreneur", tags=["entrepreneur profile"])


@router.get("", response_model=EntrepreneurOut)
async def get_profile(user: EntrepreneurUser, session: SessionDep) -> Entrepreneur:
    profile = await session.scalar(select(Entrepreneur).where(Entrepreneur.user_id == user.id))
    if profile is None:
        raise not_found("Sahibkar profili hələ yaradılmayıb")
    return profile


@router.put("", response_model=EntrepreneurOut)
async def upsert_profile(
    data: EntrepreneurIn, user: EntrepreneurUser, session: SessionDep
) -> Entrepreneur:
    """Creates or updates the applicant profile (fiziki şəxs with FİN, hüquqi şəxs with VÖEN).

    Submitted applications keep their own frozen copy, so editing here never
    changes an application that is already under review.
    """
    profile = await session.scalar(select(Entrepreneur).where(Entrepreneur.user_id == user.id))
    if profile is None:
        profile = Entrepreneur(user_id=user.id, **data.model_dump())
        session.add(profile)
    else:
        for key, value in data.model_dump().items():
            setattr(profile, key, value)
    await session.commit()
    await session.refresh(profile)
    return profile

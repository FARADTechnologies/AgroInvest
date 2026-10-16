"""Staff endpoints for competitions (R5.2): drafting, maker-checker approval, lot results."""

import uuid

from fastapi import APIRouter, Request, status
from sqlalchemy.orm import selectinload

from app.core.deps import CompetitionApprover, CompetitionManager, SessionDep, StaffUser
from app.core.errors import not_found
from app.core.ratelimit import client_ip
from app.modules.competitions import service
from app.modules.competitions.models import Competition, CompetitionStatus
from app.modules.competitions.schemas import (
    AdminCompetition,
    AdminCompetitionList,
    CompetitionInput,
    LotResult,
    ReviewDecision,
)

router = APIRouter(prefix="/admin/competitions", tags=["competitions (staff)"])


def _ip(request: Request) -> str | None:
    return client_ip(request)


async def _load(session, competition_id: uuid.UUID) -> Competition:
    comp = await session.get(
        Competition,
        competition_id,
        options=[selectinload(Competition.areas), selectinload(Competition.required_documents)],
    )
    if comp is None:
        raise not_found("Müsabiqə tapılmadı")
    return comp


@router.get("", response_model=AdminCompetitionList)
async def list_competitions(
    user: StaffUser, session: SessionDep, status: CompetitionStatus | None = None
) -> AdminCompetitionList:
    return await service.list_admin(session, user, status)


@router.get("/{competition_id}", response_model=AdminCompetition)
async def detail(
    competition_id: uuid.UUID, user: StaffUser, session: SessionDep
) -> AdminCompetition:
    return await service.to_admin(session, await _load(session, competition_id), user)


@router.post(
    "",
    response_model=AdminCompetition,
    status_code=status.HTTP_201_CREATED,
    summary="Draft a competition (specialist)",
)
async def create(
    data: CompetitionInput, user: CompetitionManager, session: SessionDep
) -> AdminCompetition:
    comp = await service.create(session, user, data)
    return await service.to_admin(session, await _load(session, comp.id), user)


@router.put("/{competition_id}", response_model=AdminCompetition, summary="Edit a draft")
async def update(
    competition_id: uuid.UUID, data: CompetitionInput, user: CompetitionManager, session: SessionDep
) -> AdminCompetition:
    comp = await service.update(session, await _load(session, competition_id), user, data)
    return await service.to_admin(session, await _load(session, comp.id), user)


@router.post(
    "/{competition_id}/submit",
    response_model=AdminCompetition,
    summary="Send a draft to a supervisor for approval",
)
async def submit(
    competition_id: uuid.UUID, user: CompetitionManager, session: SessionDep
) -> AdminCompetition:
    comp = await service.submit(session, await _load(session, competition_id), user)
    return await service.to_admin(session, comp, user)


@router.post(
    "/{competition_id}/approve",
    response_model=AdminCompetition,
    summary="Approve and publish (supervisor, never the creator)",
)
async def approve(
    competition_id: uuid.UUID,
    data: ReviewDecision,
    user: CompetitionApprover,
    session: SessionDep,
    request: Request,
) -> AdminCompetition:
    comp = await service.approve(
        session, await _load(session, competition_id), user, data.comment, _ip(request)
    )
    return await service.to_admin(session, comp, user)


@router.post(
    "/{competition_id}/return",
    response_model=AdminCompetition,
    summary="Return to the specialist with a comment (supervisor)",
)
async def send_back(
    competition_id: uuid.UUID,
    data: ReviewDecision,
    user: CompetitionApprover,
    session: SessionDep,
    request: Request,
) -> AdminCompetition:
    comp = await service.send_back(
        session, await _load(session, competition_id), user, data.comment, _ip(request)
    )
    return await service.to_admin(session, comp, user)


@router.post(
    "/{competition_id}/results",
    response_model=AdminCompetition,
    summary="Sahə üzrə nəticə: pick the winner of a plot; other applicants are declined",
)
async def lot_result(
    competition_id: uuid.UUID,
    data: LotResult,
    user: CompetitionManager,
    session: SessionDep,
    request: Request,
) -> AdminCompetition:
    comp = await _load(session, competition_id)
    await service.set_lot_result(session, comp, user, data, _ip(request))
    return await service.to_admin(session, await _load(session, competition_id), user)

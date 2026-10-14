"""Staff endpoints for incoming applications (R5.3, R5.4)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import FileResponse

from app.core.deps import SessionDep, StaffUser
from app.modules.applications import service
from app.modules.applications.models import ApplicationStatus
from app.modules.applications.router import file_response
from app.modules.applications.schemas import AdminApplicationPage, ApplicationOut, TransitionRequest
from app.modules.audit import service as audit

router = APIRouter(prefix="/admin/applications", tags=["applications (staff)"])


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get(
    "", response_model=AdminApplicationPage, summary="Incoming applications with status counts"
)
async def list_applications(
    user: StaffUser,
    session: SessionDep,
    status: ApplicationStatus | None = None,
    competition_id: uuid.UUID | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> AdminApplicationPage:
    return await service.list_for_staff(session, status, competition_id, q, page, size)


@router.get("/{application_id}", response_model=ApplicationOut, summary="Application for review")
async def detail(
    application_id: uuid.UUID, user: StaffUser, session: SessionDep, request: Request
) -> ApplicationOut:
    app = await service.get_for_staff(session, application_id)
    out = await service.build_out(session, app, user)
    # Opening an application shows personal data, so the access itself is logged.
    audit.record(
        session,
        user,
        "application.view",
        "application",
        str(app.id),
        {"number": app.number},
        client_ip(request),
    )
    await session.commit()
    return out


@router.post(
    "/{application_id}/transitions",
    response_model=ApplicationOut,
    summary="Change status: UNDER_REVIEW, INFO_REQUESTED (reason) or DECIDED (outcome + reason)",
)
async def transition(
    application_id: uuid.UUID,
    data: TransitionRequest,
    user: StaffUser,
    session: SessionDep,
    request: Request,
) -> ApplicationOut:
    app = await service.get_for_staff(session, application_id)
    await service.transition(session, app, user, data, client_ip(request))
    return await service.build_out(session, app, user)


@router.get("/{application_id}/documents/{document_id}", summary="Download an applicant's document")
async def download(
    application_id: uuid.UUID,
    document_id: uuid.UUID,
    user: StaffUser,
    session: SessionDep,
    request: Request,
) -> FileResponse:
    app = await service.get_for_staff(session, application_id)
    doc = await service.document_for_download(session, app, document_id)
    audit.record(
        session,
        user,
        "document.download",
        "application_document",
        str(doc.id),
        {"application": app.number, "type": doc.doc_type_code},
        client_ip(request),
    )
    await session.commit()
    return file_response(doc.stored_name, doc.original_name, doc.mime)

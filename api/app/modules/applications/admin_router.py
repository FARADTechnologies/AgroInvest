"""Staff endpoints for incoming applications (R5.3, R5.4)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request
from fastapi.responses import Response

from app.core.deps import ApplicationsDecider, ApplicationsViewer, IdentifierRevealer, SessionDep
from app.core.ratelimit import client_ip
from app.modules.applications import service
from app.modules.applications.models import ApplicationStatus
from app.modules.applications.router import file_response
from app.modules.applications.schemas import (
    AdminApplicationPage,
    ApplicationOut,
    RevealOut,
    RevealRequest,
    TransitionRequest,
)
from app.modules.audit import service as audit
from app.modules.entrepreneurs.models import party_identifier

router = APIRouter(prefix="/admin/applications", tags=["applications (staff)"])


@router.get(
    "", response_model=AdminApplicationPage, summary="Incoming applications with status counts"
)
async def list_applications(
    user: ApplicationsViewer,
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
    application_id: uuid.UUID, user: ApplicationsViewer, session: SessionDep, request: Request
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
    user: ApplicationsDecider,
    session: SessionDep,
    request: Request,
) -> ApplicationOut:
    app = await service.get_for_staff(session, application_id)
    await service.transition(session, app, user, data, client_ip(request))
    return await service.build_out(session, app, user)


@router.post(
    "/{application_id}/identifier",
    response_model=RevealOut,
    summary="Show the applicant's full FİN/VÖEN; needs a reason and is written to the audit log",
)
async def reveal_identifier(
    application_id: uuid.UUID,
    data: RevealRequest,
    user: IdentifierRevealer,
    session: SessionDep,
    request: Request,
) -> RevealOut:
    """Lists and screens show identifiers masked. When a specialist needs the full value
    (for example to check a certificate), they state why, and the access is audited."""
    app = await service.get_for_staff(session, application_id)
    snap = app.applicant_snapshot or {}
    audit.record(
        session,
        user,
        "application.reveal_identifier",
        "application",
        str(app.id),
        {"number": app.number, "reason": data.reason.strip()},
        client_ip(request),
    )
    await session.commit()
    return RevealOut(
        identifier_label=party_identifier(snap)[0],
        identifier=party_identifier(snap)[1],
    )


@router.get("/{application_id}/documents/{document_id}", summary="Download an applicant's document")
async def download(
    application_id: uuid.UUID,
    document_id: uuid.UUID,
    user: ApplicationsViewer,
    session: SessionDep,
    request: Request,
) -> Response:
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
    return await file_response(session, doc.stored_name, doc.original_name, doc.mime)

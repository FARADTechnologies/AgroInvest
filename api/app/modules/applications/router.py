"""Entrepreneur-facing application endpoints. Every route checks ownership."""

import uuid
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, File, Form, UploadFile, status
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.core.deps import EntrepreneurUser, SessionDep
from app.modules.applications import service
from app.modules.applications.schemas import (
    ApplicationOut,
    ApplicationSummary,
    CreateApplication,
    InfoResponse,
    UpdateApplication,
)
from app.modules.documents import storage

router = APIRouter(prefix="/applications", tags=["applications (entrepreneur)"])


async def read_limited(file: UploadFile) -> bytes:
    """Reads at most the configured limit (+1 byte to detect oversize) into memory."""
    limit = get_settings().max_upload_mb * 1024 * 1024
    return await file.read(limit + 1)


def file_response(stored_name: str, original_name: str, mime: str) -> FileResponse:
    return FileResponse(
        storage.path_of(stored_name),
        media_type=mime,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(original_name)}",
            "Cache-Control": "no-store",
        },
    )


@router.get("", response_model=list[ApplicationSummary], summary="My applications")
async def my_applications(user: EntrepreneurUser, session: SessionDep) -> list[ApplicationSummary]:
    return await service.list_mine(session, user)


@router.post(
    "",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start (or resume) a draft for a farm area in its open competition",
)
async def create(
    data: CreateApplication, user: EntrepreneurUser, session: SessionDep
) -> ApplicationOut:
    app = await service.create_draft(session, user, data.area_code)
    return await service.build_out(session, app, user)


@router.get("/{application_id}", response_model=ApplicationOut)
async def detail(
    application_id: uuid.UUID, user: EntrepreneurUser, session: SessionDep
) -> ApplicationOut:
    app = await service.get_owned(session, user, application_id)
    return await service.build_out(session, app, user)


@router.patch("/{application_id}", response_model=ApplicationOut, summary="Edit a draft")
async def update(
    application_id: uuid.UUID, data: UpdateApplication, user: EntrepreneurUser, session: SessionDep
) -> ApplicationOut:
    app = await service.get_owned(session, user, application_id)
    await service.update_draft(session, app, data)
    return await service.build_out(session, app, user)


@router.post(
    "/{application_id}/documents",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Attach a document (PDF, JPG, PNG, DOCX, XLSX; type checked from content)",
)
async def upload(
    application_id: uuid.UUID,
    user: EntrepreneurUser,
    session: SessionDep,
    doc_type_code: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
) -> ApplicationOut:
    app = await service.get_owned(session, user, application_id)
    data = await read_limited(file)
    await service.add_document(session, app, user, doc_type_code, file.filename or "sened", data)
    return await service.build_out(session, app, user)


@router.delete(
    "/{application_id}/documents/{document_id}",
    response_model=ApplicationOut,
    summary="Remove a document from a draft",
)
async def remove(
    application_id: uuid.UUID, document_id: uuid.UUID, user: EntrepreneurUser, session: SessionDep
) -> ApplicationOut:
    app = await service.get_owned(session, user, application_id)
    await service.remove_document(session, app, document_id)
    return await service.build_out(session, app, user)


@router.get("/{application_id}/documents/{document_id}", summary="Download my document")
async def download(
    application_id: uuid.UUID, document_id: uuid.UUID, user: EntrepreneurUser, session: SessionDep
) -> FileResponse:
    app = await service.get_owned(session, user, application_id)
    doc = await service.document_for_download(session, app, document_id)
    return file_response(doc.stored_name, doc.original_name, doc.mime)


@router.post(
    "/{application_id}/submit",
    response_model=ApplicationOut,
    summary="Submit: checks completeness and deadline, assigns the application number",
)
async def submit(
    application_id: uuid.UUID, user: EntrepreneurUser, session: SessionDep
) -> ApplicationOut:
    app = await service.get_owned(session, user, application_id)
    await service.submit(session, app, user)
    return await service.build_out(session, app, user)


@router.post(
    "/{application_id}/info-response",
    response_model=ApplicationOut,
    summary="Answer an 'Əlavə məlumat tələb olunur' request; the application returns to review",
)
async def info_response(
    application_id: uuid.UUID, data: InfoResponse, user: EntrepreneurUser, session: SessionDep
) -> ApplicationOut:
    app = await service.get_owned(session, user, application_id)
    await service.respond_info(session, app, user, data.response_text)
    return await service.build_out(session, app, user)

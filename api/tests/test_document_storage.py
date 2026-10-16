"""Uploaded documents live in the database, so a redeploy that wipes the disk keeps them."""

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionFactory
from app.modules.documents.models import DocumentBlob

from .test_application_flow import (
    PDF,
    _fill_and_submit,
    _new_client,
    _open_area_code,
    _register_company,
)


async def test_documents_are_stored_in_the_database_and_downloadable():
    applicant = await _new_client()
    async with applicant:
        await _register_company(applicant)
        app = await _fill_and_submit(applicant, await _open_area_code(applicant))
        doc = app["documents"][0]

        r = await applicant.get(f"/api/v1/applications/{app['id']}/documents/{doc['id']}")
        assert r.status_code == 200
        assert r.content == PDF
        assert "attachment" in r.headers["content-disposition"]

    async with SessionFactory() as session:
        names = (await session.scalars(select(DocumentBlob.stored_name))).all()
    assert names, "uploads are kept in document_blob"
    upload_dir = get_settings().upload_dir
    assert not any((upload_dir / n).exists() for n in names), "nothing is written to the disk"

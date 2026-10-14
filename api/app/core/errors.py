"""Problem Details (RFC 9457) error responses with Azerbaijani messages."""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class DomainError(HTTPException):
    """A business-rule violation with a stable machine-readable code."""

    def __init__(self, status_code: int, code: str, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail)
        self.code = code


def not_found(detail: str = "Tapılmadı") -> DomainError:
    return DomainError(404, "not_found", detail)


def forbidden(detail: str = "Bu əməliyyat üçün icazəniz yoxdur") -> DomainError:
    return DomainError(403, "forbidden", detail)


def conflict(code: str, detail: str) -> DomainError:
    return DomainError(409, code, detail)


def unprocessable(code: str, detail: str) -> DomainError:
    return DomainError(422, code, detail)


def _problem(status: int, code: str, detail: str, **extra) -> JSONResponse:
    body = {"type": f"about:blank#{code}", "title": code, "status": status, "detail": detail}
    body.update(extra)
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError) -> JSONResponse:
        return _problem(exc.status_code, exc.code, str(exc.detail))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = {
            400: "Sorğunun formatı düzgün deyil",
            404: "Tapılmadı",
            405: "Metod dəstəklənmir",
        }.get(exc.status_code, str(exc.detail))
        return _problem(exc.status_code, f"http_{exc.status_code}", detail)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return _problem(422, "validation_error", "Məlumatlar düzgün doldurulmayıb", errors=errors)

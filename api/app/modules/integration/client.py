"""The EKTIS client: one interface, implementations chosen by configuration.

`EKTIS_MODE=mock` talks to the bundled EKTIS mock over the same REST contract the
real system would expose (docs/ektis-v1.openapi.yaml). A production client would
implement the same protocol against EKTIS through EHİS once the authority grants
access; nothing in the portal changes apart from the configuration.
`EKTIS_MODE=disabled` makes no calls at all: messages wait in the outbox.
"""

import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.core.config import get_settings


@dataclass
class EktisResult:
    """Outcome of one call, whatever happened, so it can always be logged."""

    method: str
    path: str
    status_code: int | None  # None when EKTIS could not be reached at all
    duration_ms: int
    request_id: str
    data: Any = None
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.status_code is not None and 200 <= self.status_code < 300


class EktisClient(Protocol):
    async def lookup_farmer(
        self, *, fin: str | None, voen: str | None, request_id: str
    ) -> EktisResult: ...

    async def send_decision(self, payload: dict, request_id: str) -> EktisResult: ...

    async def get_fault(self, request_id: str) -> EktisResult: ...

    async def set_fault(self, mode: str, request_id: str) -> EktisResult: ...


class HttpEktisClient:
    """REST client for the EKTIS contract. Every call carries the API key and X-Request-ID."""

    def __init__(self, base_url: str, api_key: str, timeout: float = 5.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    async def _call(
        self, method: str, path: str, request_id: str, extra: dict | None = None, **kwargs: Any
    ) -> EktisResult:
        headers = {"X-API-Key": self.api_key, "X-Request-ID": request_id, **(extra or {})}
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout) as http:
                response = await http.request(method, path, headers=headers, **kwargs)
        except httpx.HTTPError as exc:
            return EktisResult(
                method,
                path,
                None,
                _ms(started),
                request_id,
                error=f"{type(exc).__name__}: EKTIS əlçatan deyil",
            )
        try:
            data = response.json()
        except ValueError:
            data = None
        error = None
        if response.status_code >= 400:
            detail = data.get("detail") if isinstance(data, dict) else None
            error = f"HTTP {response.status_code}: {detail or response.reason_phrase}"[:300]
        return EktisResult(
            method, path, response.status_code, _ms(started), request_id, data, error
        )

    async def lookup_farmer(
        self, *, fin: str | None, voen: str | None, request_id: str
    ) -> EktisResult:
        params = {"fin": fin} if fin else {"voen": voen}
        return await self._call("GET", "/farmers", request_id, params=params)

    async def send_decision(self, payload: dict, request_id: str) -> EktisResult:
        # The decision id doubles as the idempotency key: a retry never registers twice.
        extra = {"Idempotency-Key": str(payload["decisionId"])}
        return await self._call("POST", "/land-use-decisions", request_id, extra, json=payload)

    async def get_fault(self, request_id: str) -> EktisResult:
        return await self._call("GET", "/_mock/faults", request_id)

    async def set_fault(self, mode: str, request_id: str) -> EktisResult:
        return await self._call("POST", "/_mock/faults", request_id, json={"mode": mode})


class DisabledEktisClient:
    """Makes no calls: used when the integration is switched off by configuration."""

    async def _off(self, method: str, path: str, request_id: str) -> EktisResult:
        return EktisResult(
            method, path, None, 0, request_id, error="EKTİS inteqrasiyası söndürülüb"
        )

    async def lookup_farmer(
        self, *, fin: str | None, voen: str | None, request_id: str
    ) -> EktisResult:
        return await self._off("GET", "/farmers", request_id)

    async def send_decision(self, payload: dict, request_id: str) -> EktisResult:
        return await self._off("POST", "/land-use-decisions", request_id)

    async def get_fault(self, request_id: str) -> EktisResult:
        return await self._off("GET", "/_mock/faults", request_id)

    async def set_fault(self, mode: str, request_id: str) -> EktisResult:
        return await self._off("POST", "/_mock/faults", request_id)


def _ms(started: float) -> int:
    return round((time.perf_counter() - started) * 1000)


def get_ektis_client() -> EktisClient:
    """FastAPI dependency and worker factory; tests override it with a fake."""
    settings = get_settings()
    if settings.ektis_mode == "mock":
        return HttpEktisClient(settings.ektis_base_url, settings.ektis_api_key)
    return DisabledEktisClient()

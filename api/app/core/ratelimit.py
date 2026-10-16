"""Sliding-window limits per client IP, kept in memory.

The prototype runs one API process; with several replicas the same small interface
would move to a shared store such as Redis.
"""

import hmac
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import DomainError


class SlidingWindow:
    """At most `limit` events per key within `window_s` seconds."""

    def __init__(self, limit: int, window_s: int) -> None:
        self.limit = limit
        self.window_s = window_s
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str, now: float) -> deque[float]:
        events = self._events[key]
        while events and events[0] <= now - self.window_s:
            events.popleft()
        return events

    def retry_after(self, key: str) -> int | None:
        """Seconds until the key may act again, or None while it is under the limit."""
        now = time.monotonic()
        events = self._recent(key, now)
        if len(events) < self.limit:
            return None
        return max(1, int(events[0] + self.window_s - now) + 1)

    def add(self, key: str) -> None:
        self._events[key].append(time.monotonic())


def client_ip(request: Request) -> str:
    """The caller's address, for per-address limits and the audit log.

    Hosted, the API is reachable directly and through the web app's proxy. The proxy sends the
    visitor's address with a shared secret (PORTAL_PROXY_SECRET); a matching secret is the only
    way that header is believed. Otherwise Cloudflare's CF-Connecting-IP, which clients cannot
    set, identifies a direct caller. Without a configured secret (local Docker, where nginx
    rewrites X-Forwarded-For itself) uvicorn's resolved address is used.
    """
    secret = get_settings().portal_proxy_secret
    if secret:
        given = request.headers.get("x-portal-proxy-secret", "")
        forwarded = request.headers.get("x-portal-client-ip", "").strip()
        if forwarded and hmac.compare_digest(given.encode(), secret.encode()):
            return forwarded[:64]
        edge = request.headers.get("cf-connecting-ip", "").strip()
        if edge:
            return edge[:64]
    return request.client.host if request.client else "unknown"


def too_many_requests(retry_after: int) -> DomainError:
    minutes = max(1, round(retry_after / 60))
    return DomainError(
        429,
        "too_many_requests",
        f"Bu ünvandan çox sayda cəhd edilib. Təxminən {minutes} dəqiqə sonra yenidən cəhd edin.",
        headers={"Retry-After": str(retry_after)},
    )

"""Sliding-window limits per client IP, kept in memory.

The prototype runs one API process; with several replicas the same small interface
would move to a shared store such as Redis.
"""

import time
from collections import defaultdict, deque

from fastapi import Request

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
    """The caller's address; uvicorn resolves X-Forwarded-For from the web proxy."""
    return request.client.host if request.client else "unknown"


def too_many_requests(retry_after: int) -> DomainError:
    minutes = max(1, round(retry_after / 60))
    return DomainError(
        429,
        "too_many_requests",
        f"Bu ünvandan çox sayda cəhd edilib. Təxminən {minutes} dəqiqə sonra yenidən cəhd edin.",
        headers={"Retry-After": str(retry_after)},
    )

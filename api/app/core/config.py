from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Aqrar İnvestisiya Portalı API"
    environment: str = "demo"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://agro:agro@localhost:5433/agro"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    cookie_name: str = "portal_session"
    cookie_secure: bool = False

    # Login throttling: after this many failures the account is locked for a while.
    max_failed_logins: int = 5
    lockout_minutes: int = 10
    # Per client IP, against password spraying across many accounts and sign-up spam.
    # Generous on purpose: behind Docker Desktop's NAT every LAN client shares one address.
    login_failures_per_ip: int = 30
    login_failure_window_minutes: int = 10
    registrations_per_ip_hour: int = 10

    # Shared with the web app's proxy, which forwards the visitor's address with it.
    # Empty: no proxy in front (local Docker uses nginx and uvicorn's proxy headers).
    portal_proxy_secret: str = ""

    ektis_mode: str = "mock"
    ektis_base_url: str = "http://ektis-mock:8081/ektis/v1"
    ektis_api_key: str = ""
    ektis_hmac_secret: str = ""
    # Background delivery of the EKTIS outbox; tests switch it off and drive it directly.
    integration_worker: bool = True
    integration_poll_seconds: float = 3.0

    demo_password: str = ""
    upload_dir: Path = Path("/data/uploads")
    max_upload_mb: int = 10
    seed_dir: Path = Path("/seed")

    # Suitability factor sources: JSON, or a path to a .json file, mapping a factor to an
    # adapter, e.g. {"ph": {"adapter": "csv", "path": "/seed/factors/ph.csv"}}. Empty: demo values.
    suitability_sources: str = ""

    # Deadlines are stored in UTC and shown in Baku time.
    display_timezone: str = "Asia/Baku"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

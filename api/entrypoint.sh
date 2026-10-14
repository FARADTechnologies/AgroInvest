#!/bin/sh
# Brings the database schema up to date, loads seed data on an empty database,
# then serves the API. Every step is idempotent, so restarts are safe.
set -e

alembic upgrade head
python -m app.seed

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*"

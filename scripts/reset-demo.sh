#!/bin/sh
# Restores a clean demo state: drops the database and uploaded files, then
# starts the stack again so migrations and seed data run from scratch.
set -e
cd "$(dirname "$0")/.."
docker compose down -v
docker compose up -d --build
echo "Demo state restored."

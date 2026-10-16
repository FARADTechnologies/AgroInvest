#!/bin/sh
# Render glue around the upstream entrypoint, so api/ stays an exact copy of
# the backend repository and syncing it never overwrites anything of ours.
#
# - Render hands out DATABASE_URL as postgres://… / postgresql://…; SQLAlchemy
#   with asyncpg needs postgresql+asyncpg://.
# - Render tells the service which port to listen on through $PORT; the upstream
#   entrypoint listens on 8000.
set -e

case "$DATABASE_URL" in
  postgres://*) DATABASE_URL="postgresql+asyncpg://${DATABASE_URL#postgres://}" ;;
  postgresql://*) DATABASE_URL="postgresql+asyncpg://${DATABASE_URL#postgresql://}" ;;
esac
# libpq query parameters (Neon, Supabase) that asyncpg spells differently or rejects.
DATABASE_URL=$(printf "%s" "$DATABASE_URL" | sed -e "s/sslmode=/ssl=/" -e "s/[&?]channel_binding=[^&]*//")
export DATABASE_URL

sed "s/--port 8000/--port ${PORT:-8000}/" /app/entrypoint.sh > /tmp/entrypoint.sh
exec sh /tmp/entrypoint.sh "$@"

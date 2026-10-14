#!/bin/sh
# Starts the whole portal. On the first run it creates .env from .env.example
# and replaces every secret with a random value.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  for key in POSTGRES_PASSWORD JWT_SECRET EKTIS_API_KEY EKTIS_HMAC_SECRET; do
    value=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
    sed -i.bak "s|^$key=.*|$key=$value|" .env
  done
  rm -f .env.bak
  echo "Created .env with random secrets."
fi

docker compose up -d --build
echo "Portal:     http://localhost:3000"
echo "API docs:   http://localhost:8000/api/v1/docs"
echo "EKTIS mock: http://localhost:8081/swagger-ui.html"

# API image for Render. Same as api/Dockerfile, but built from the repository
# root so the seed data (farm areas, rayons, reference CSVs) is baked in:
# Render has no bind mounts, and the seed loads on the first start.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    SEED_DIR=/seed \
    UPLOAD_DIR=/data/uploads

WORKDIR /app

COPY api/requirements.txt ./
RUN pip install -r requirements.txt

COPY api/ ./
COPY seed/ /seed/

RUN useradd --create-home --uid 10001 portal \
    && mkdir -p /data/uploads \
    && chown -R portal /data/uploads \
    && chmod +x /app/entrypoint.sh

USER portal

EXPOSE 10000
ENTRYPOINT ["/app/entrypoint.sh"]

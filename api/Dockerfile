FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
# Test tooling is installed too, so the suite can run inside the stack:
#   docker compose run --rm api pytest
RUN pip install -r requirements.txt -r requirements-dev.txt

COPY . .

RUN useradd --create-home --uid 10001 portal \
    && mkdir -p /data/uploads \
    && chown -R portal /data/uploads \
    && chmod +x /app/entrypoint.sh

USER portal

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]

# Aqrar İnvestisiya Portalı

Prototype of the **investment competition portal for agricultural land in the territories
liberated from occupation** (Karabakh and East Zangezur economic regions). Entrepreneurs find
farm areas on a map, compare them, apply to a competition online and track their application.
Ministry specialists manage areas and competitions, review applications and record decisions.
The portal is designed for future integration with **EKTİS**, the Ministry of Agriculture's
Electronic Agriculture Information System; a mock of the EKTİS interface is included.

> Prototip — all farm areas, competitions, applicants and demining data in this repository are
> demo data.

## Run it

Requirements: Docker Desktop (Windows/macOS) or Docker Engine with Compose v2, about 6 GB of
free RAM. No other tools are needed. After the first build everything works offline.

```powershell
./scripts/start.ps1        # Windows
```

```sh
./scripts/start.sh         # macOS / Linux
```

The first run creates `.env` from `.env.example` with random secrets, builds the images and
starts the stack. Later runs only need `docker compose up -d`.

| What | URL |
|---|---|
| Portal | http://localhost:3000 |
| Portal API (Swagger) | http://localhost:8000/api/v1/docs |
| EKTİS mock (Swagger) | http://localhost:8081/swagger-ui.html |

Only the portal (port 3000) is published on the network. The API, the EKTİS mock and the
database listen on `localhost` only.

To restore a clean demo state (drops the database and uploaded files):

```powershell
./scripts/reset-demo.ps1
```

## Demo accounts

Created by the seed; the password is `DEMO_PASSWORD` from `.env` (default `Demo2026!`).

| Role | E-mail |
|---|---|
| Sahibkar (entrepreneur) | _added in M1_ |
| Mütəxəssis (specialist) | _added in M1_ |
| Rəhbər (supervisor) | _added in M1_ |

## Repository layout

| Path | Contents |
|---|---|
| `api/` | Portal API: FastAPI, SQLAlchemy, Alembic, PostGIS |
| `ektis-mock/` | EKTİS interface test double: Java 21, Spring Boot 3 |
| `web/` | Portal UI: Next.js, TypeScript, Tailwind, MapLibre |
| `geo/` | Offline pipeline that builds farm areas and suitability scores |
| `seed/` | Seed data loaded on first start |
| `docs/` | Requirements traceability, data model, integration, roadmap |

## Development

```sh
docker compose run --rm api pytest            # API tests
docker compose run --rm api ruff check app    # API lint
cd web && npm install && npm run typecheck    # UI type check
cd web && npm run gen:api                     # regenerate the typed API client (API must be running)
```

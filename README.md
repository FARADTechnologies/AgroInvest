# Aqrar İnvestisiya Portalı

Prototype of the **investment competition portal for agricultural land in the territories
liberated from occupation** (Karabakh and East Zangezur economic regions). Entrepreneurs find
farm areas on a map, compare them, apply to a competition online and track their application.
Ministry specialists manage areas and competitions with an approval mechanism, review
applications, record decisions and produce statistics. The portal is designed for future
integration with **EKTİS**, the Ministry of Agriculture's Electronic Agriculture Information
System; a mock of the EKTİS interface is included and the real system is never contacted.

> Prototip — farm-area terms, competitions, applicants and demining data in this repository are
> demo data. Geography comes from OpenStreetMap.

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
starts the stack. Later runs only need `docker compose up -d`. On Windows, start Docker Desktop
first.

| What | URL |
|---|---|
| Portal | http://localhost:3000 |
| Portal API (Swagger) | http://localhost:3000/api/v1/docs |
| EKTİS mock (Swagger, server only) | http://localhost:8081/swagger-ui.html |
| About and architecture | http://localhost:3000/about |

Only the nginx gateway (port 3000) is published on the network. The API, the EKTİS mock and the
database listen on `localhost` only.

To restore a clean demo state (drops the database and uploaded files; deadlines are set relative
to now):

```powershell
./scripts/reset-demo.ps1
```

## Demo accounts

Created by the seed; the password is `DEMO_PASSWORD` from `.env` (default `Demo2026!`).

| Role | E-mail | What to try |
|---|---|---|
| İnvestor (investor) | `investor@agro-demo.test` | budget and interests in the profile, catalogue filtered by them, apply to a listing, receipt, EKTİS registry check, track the application |
| Sahibkar (lists land) | `sahibkar@agro-demo.test` | place a listing by drawing the plot on the map, follow investors' applications to their listings |
| Mütəxəssis (commission) | `mutexessis@agro-demo.test` | review queue, request information, decide, competitions, areas, statistics, integration log |
| Rəhbər (commission) | `rehber@agro-demo.test` | approves or returns competitions (cannot approve their own) |
| Administrator | `admin@agro-demo.test` | everything |

Investors and sahibkars register at `/register`; commission staff are not offered at sign-in
and simply sign in with their e-mail. The `.test` domain is reserved, so these addresses
can never receive real mail. The step-by-step demo is in [`docs/demo-script.md`](docs/demo-script.md).

## What it does

| Module (technical task §4) | Where |
|---|---|
| Agrarian investment map: plots, size, purpose, filters, detail page | `/map`, `/areas/<code>`; satellite view; offline map |
| Investment opportunities catalogue: terms of use, deadlines, search, comparison | `/catalogue`, `/competitions`, `/compare` with a TOPSIS "Qərar dəstəyi" |
| Electronic application: account, FİN/VÖEN, plot, business plan, documents, number | `/register`, `/cabinet/applications/new`, receipt |
| Application tracking: statuses, history, notifications | `/cabinet` |
| Administrative panel: areas, competitions with approval, applications, statistics and reports | `/admin/*`, Excel export |
| EKTİS integration readiness | outbox, retries, `/admin/integration`, `docs/integration.md` |

Every requirement is traced in [`docs/requirements.md`](docs/requirements.md).

## Documentation

| Document | Contents |
|---|---|
| [`docs/data-model.md`](docs/data-model.md) | ER diagram generated from the models, states, constraints |
| [`docs/integration.md`](docs/integration.md) | EKTİS integration concept, security, switching to the real system |
| [`docs/ektis-v1.openapi.yaml`](docs/ektis-v1.openapi.yaml) | EKTİS interface contract |
| [`docs/api-examples.md`](docs/api-examples.md) | API calls for the main flows |
| [`docs/roadmap.md`](docs/roadmap.md) | 4–8 week plan to a pilot, what is demo and what is real |
| [`docs/demo-script.md`](docs/demo-script.md) | demo walkthrough |
| [`docs/qa-sheet.md`](docs/qa-sheet.md) | likely questions and answers |
| [`docs/reused-code.md`](docs/reused-code.md) | reused patterns, libraries and data licences |

## Using it from a second laptop

The portal is reachable from other devices on the same network at `http://<server IPv4>:3000`
(find the address with `ipconfig`). Venue Wi-Fi often isolates clients, so a phone hotspot is the
safer choice. On Windows, allow the port once (administrator PowerShell):

```powershell
New-NetFirewallRule -DisplayName "Aqrar Portal (3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any
# afterwards: Remove-NetFirewallRule -DisplayName "Aqrar Portal (3000)"
```

## Without internet

Everything runs locally. The online basemap and the satellite view need the internet; without it
the map switches to an offline basemap whose roads and water are served by the API from PostGIS.
`/map?offline=1` shows that mode on purpose. Before going offline, make sure the images exist
locally (`docker compose build` and `docker compose pull`).

## Repository layout

| Path | Contents |
|---|---|
| `api/` | Portal API: FastAPI, SQLAlchemy 2, Alembic, PostGIS; modules under `app/modules/` |
| `ektis-mock/` | EKTİS interface test double: Java 21, Spring Boot 3 |
| `web/` | Portal UI: Next.js, TypeScript, Tailwind, MapLibre |
| `deploy/nginx/` | gateway configuration |
| `geo/` | offline pipeline that builds boundaries, plots, roads and water from OpenStreetMap |
| `seed/` | seed data loaded on start |
| `docs/` | documentation listed above |
| `scripts/` | start and reset scripts |

## Development

```sh
# API tests and lint (the API container with the source mounted)
docker compose run --rm --no-deps --entrypoint "" -v "$PWD/api:/app" api sh -c "ruff check app tests && pytest -q"

# EKTİS mock build and tests (no local JDK needed)
docker run --rm -v "$PWD/ektis-mock:/src" -w /src maven:3.9-eclipse-temurin-21 mvn -q -B verify

# UI
cd web && npm install && npm run typecheck
cd web && npm run dev -- -p 3001     # development server against the API on :8000
cd web && npm run gen:api            # regenerate the typed API client (API running)

# Rebuild the geography (needs the Geofabrik extract in geo/cache/ and GeoPandas)
python geo/build_base.py && python geo/build_layers.py
```

On Git Bash for Windows, prefix Docker commands that mount a path with `MSYS_NO_PATHCONV=1` and
use `$(pwd -W)` instead of `$PWD`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `docker` cannot connect | start Docker Desktop and wait until it reports running |
| Port 3000 in use | stop the other process or change the gateway port in `docker-compose.yml` |
| Map shows only a plain background | no internet: expected; roads and water still come from the API |
| Too many failed sign-ins | wait for the time in the message (per-address limit) or ten minutes for a locked account |

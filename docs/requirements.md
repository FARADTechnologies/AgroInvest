# Requirements traceability

Every requirement from the technical task has an ID. Status values:
`todo` · `partial` · `done` · `demo-ready` (works on a fresh `docker compose up`, offline).

Tags: **[PDF]** stated in the task · **[INTERP]** our reading of something the task implies · **[OURS]** our addition.

## Module 1: Agrarian investment map [PDF §4.1]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R1.1 | Farm areas offered in Karabakh shown on a map | done | `/map`, `FarmMap` (MapLibre, own AZ labels, mask outside AZ); "Xəritə / Peyk" switch with Esri World Imagery (Maxar, Earthstar Geographics; online only), no labels |
| R1.2 | Location, size and designated purpose per area | done | map hover card, selected-area card, list rows |
| R1.3 | Filter by əkinçilik / heyvandarlıq / bağçılıq / digər | done | purpose chips with counts, URL-shareable filters; plus "Maliyyə şərtləri" (annual fee AZN/ha and minimum investment ranges, filtered in the API) on map and catalogue |
| R1.4 | Detailed information page per area | done | `/areas/[code]` |

## Module 2: Investment opportunities catalogue [PDF §4.2]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R2.1 | List of areas put up for competition | done | `/catalogue`, `/competitions/[number]` lots |
| R2.2 | Dimensions, location and conditions of use (istifadə şərtləri) | done | catalogue rows, area detail |
| R2.3 | Final application deadline of the competition | done | date + countdown (Baku time) |
| R2.4 | Comparison of selected areas | done | "Müqayisəyə əlavə et" on map card and area page (max 4), tray, `/compare?codes=` side by side with mini maps; "Qərar dəstəyi": TOPSIS ranking with user weights or presets, per-criterion table, explanation and a ±20 % weight sensitivity check (no ML) |
| R2.5 | Search capability (§9 "axtarış imkanı") | done | map and catalogue search: diacritic-insensitive (`az_fold`) + typo-tolerant (`pg_trgm` word_similarity ≥ 0.4) |

## Module 3: Electronic application [PDF §4.3]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R3.1 | Account creation and login | done | `/register` (consent), `/login`, Argon2id, lockout |
| R3.2 | Entrepreneur or company data (FİN / VÖEN) | done | wizard step 1 / `/cabinet/profile` (fiziki/hüquqi şəxs) |
| R3.3 | Select the farm area | done | "Müraciət et" from map, catalogue, area page → wizard step 2 |
| R3.4 | Investment and business plan data | done | wizard step 3, min. investment hint |
| R3.5 | Attach required documents | done | wizard step 4, per-competition list, content-type check |
| R3.6 | Register the application and generate its number | done | `QIM-<year>-<seq>` from a DB sequence at submit |

## Module 4: Application tracking [PDF §4.4]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R4.1 | List of applications | done | `/cabinet` |
| R4.2 | Statuses Qəbul edilib, Baxılır, Əlavə məlumat tələb olunur, Qərar verilib | done | server-side state machine + Qaralama + outcome Qalib/İmtina |
| R4.3 | Application history | done | timeline with actor role, time and reason |
| R4.4 | Notifications for the user | done | header bell with unread count, `/cabinet/notifications` |

## Module 5: Administrative panel [PDF §4.5]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R5.1 | Add and edit farm areas | done | `/admin/areas`: GeoJSON paste/upload with map preview; code, size, rayon, nearest village derived in PostGIS; plots in a competition keep geometry and purpose |
| R5.2 | Create and manage competitions with an approval mechanism | done | `/admin/competitions`: draft, submit, supervisor approve/return (four-eyes), lot results |
| R5.3 | View incoming applications | done | `/admin/applications` with status tabs, search, masked FİN/VÖEN |
| R5.4 | Change application status | done | review screen: only allowed transitions, reasons, decision confirmation |
| R5.5 | Statistics and reports (dashboard + export) | done | `/admin/stats` (KPIs, status, 30-day, rayon, purpose, competitions) + Excel report (masked, Baku time) |

## EKTIS integration [PDF §5, "the most important technical part"]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R6.1 | API readiness: data exchange interface or a working simulation | done | `ektis-mock/` (Java 21, Spring Boot): farmer lookup by FIN/VOEN, land-use decisions (idempotent on decisionId), API key, X-Request-ID, fault injection; contract in `docs/ektis-v1.openapi.yaml`; portal client, outbox and log in `api/app/modules/integration` |
| R6.2 | Data model for entrepreneur, farm area, competition, application | done | `api/app/modules/*/models.py`, migrations 0001–0005, `docs/data-model.md` (ER generated from the models) |
| R6.3 | Security: user roles, access rights, personal-data protection | done | roles on every endpoint, ownership (404 for others), FIN/VOEN masked with an audited reveal that needs a reason, audit of views/downloads/decisions, upload checks, account lockout, per-IP limits on failed logins and sign-ups, nginx gateway that sets the real client address; hash-chained, append-only audit log |
| R6.4 | Modular architecture | done | API modules (identity, areas, competitions, applications, documents, notifications, reports, audit, integration, geo); EKTIS as a separate service; gateway; UI talks to the API only through the generated client |
| R6.5 | Documentation: API examples, data schema, integration approach | done | Swagger on both services, `docs/api-examples.md`, `docs/data-model.md`, `docs/integration.md`, `docs/ektis-v1.openapi.yaml` |
| R6.6 | No connection to the real EKTIS; switchable client via config | done | `EktisClient` protocol, `HttpEktisClient` (`EKTIS_MODE=mock`) or no calls (`disabled`); a production client implements the same protocol via EHİS |

## Demonstration [PDF §3]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R7.1 | Demonstrate functionality | done | `docs/demo-script.md` (core path + extras) |
| R7.2 | Demonstrate ease of use | done | demo path on the map, wizard with completeness, Azerbaijani UI, receipt |
| R7.3 | Demonstrate data security | done | security moment in the demo script; `/about` security section; `docs/qa-sheet.md` |
| R7.4 | Demonstrate future development possibilities | done | `/about` (process map, architecture, EKTIS flow, roadmap), `docs/roadmap.md` |

## Delivery package [PDF §9]

| ID | Deliverable | Status | Where |
|---|---|---|---|
| D1 | Working portal prototype | done | `docker compose up` / `scripts/start.ps1` |
| D2 | Catalogue of investment areas and search | done | `/catalogue`, `/map`, search |
| D3 | Electronic application creation and status tracking | done | wizard, cabinet, notifications |
| D4 | Initial version of the admin panel | done | applications, competitions (maker-checker), areas, statistics |
| D5 | Database structure / data model | done | `docs/data-model.md` |
| D6 | API and integration concept | done | `docs/integration.md`, `docs/api-examples.md`, OpenAPI |
| D7 | Source code and technical documentation | done | this repository, `docs/` |
| D8 | Installation and launch instructions | done | `README.md` (one command, accounts, second laptop, offline, troubleshooting) |
| D9 | Technical roadmap | done | `docs/roadmap.md`, `/about` |

## Our additions [OURS]

| ID | Addition | Status |
|---|---|---|
| O1 | Suitability score per farm area (GIS MCDA, AHP weights, FAO classes) | done | distances to OSM roads and water measured in PostGIS, AHP weights per activity (CR < 0.1), fuzzy memberships, demining constraint → N; scored at seed and when staff add or edit a plot; 18 factors in four groups with a two-level AHP and an expert editor (`/admin/suitability`); soil, climate and terrain values are synthetic and tagged until real datasets are loaded (`docs/data-sources.md`) |
| O2 | EKTIS mock with outbox, retry and a visible integration log | done | outbox in the decision transaction, background delivery with backoff, idempotent resend; `/admin/integration` (İnteqrasiya logu: connection state, outage simulation, queue, calls with X-Request-ID); farmer lookup in the wizard and profile; delivery state on the review screen |; EKTIS confirms with a signed callback (HMAC-SHA256, timestamp, Idempotency-Key)
| O3 | Maker-checker roles (Mütəxəssis / Rəhbər) | done |
| O4 | Real geography from OpenStreetMap, curated Azerbaijani names only; land outline and Caspian shoreline from the OSM coastline (Absheron included); roads and water served as vector tiles from PostGIS so the map works offline (`/map?offline=1` shows it) | done |
| O5 | Demining status as a hard publishing constraint (synthetic, labelled) | done |
| O6 | Personal-data consent, FİN/VÖEN masking, audit log | done | consent at registration, masking with an audited reveal, append-only audit log sealed into a SHA-256 hash chain with a verification screen (`/admin/audit`, supervisors and admins) |
| O7 | Downloadable application receipt (PDF) | done | `/cabinet/applications/[id]/receipt`: print view saved as PDF from the browser (portal font, every Azerbaijani letter); linked after submission and on the application page |
| O8 | Competition-specific required-documents list | done |
| O9 | Public transparency statistics | done | `/transparency` (Şəffaflıq): aggregates only — competitions, plots, applications by status, decisions, planned investment and jobs, local share, decision time, by rayon and purpose; published competitions only |
| O10 | AZ/EN language toggle | done | whole portal, admin console, assistant and its server messages; suitability factor names by key |
| O11 | Aqrar köməkçi (AI assistant) | done | answers through tools over the portal's own API (catalogue, plot, compare, competitions, statistics, own applications); plot codes link to plot pages; dictation through the browser's speech recognition; per-address and daily limits |
| O12 | Listing desk and investor preferences | done | the administrator draws a plot on the map and publishes a listing (`/admin/listings`); portal users save budget and interests, and the catalogue opens filtered by them |

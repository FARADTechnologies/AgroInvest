# Requirements traceability

Every requirement from the technical task has an ID. Status values:
`todo` · `partial` · `done` · `demo-ready` (works on a fresh `docker compose up`, offline).

Tags: **[PDF]** stated in the task · **[INTERP]** our reading of something the task implies · **[OURS]** our addition.

## Module 1: Agrarian investment map [PDF §4.1]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R1.1 | Farm areas offered in Karabakh shown on a map | done | `/map`, `FarmMap` (MapLibre, own AZ labels, mask outside AZ) |
| R1.2 | Location, size and designated purpose per area | done | map hover card, selected-area card, list rows |
| R1.3 | Filter by əkinçilik / heyvandarlıq / bağçılıq / digər | done | purpose chips with counts, URL-shareable filters |
| R1.4 | Detailed information page per area | done | `/areas/[code]` |

## Module 2: Investment opportunities catalogue [PDF §4.2]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R2.1 | List of areas put up for competition | done | `/catalogue`, `/competitions/[number]` lots |
| R2.2 | Dimensions, location and conditions of use (istifadə şərtləri) | done | catalogue rows, area detail |
| R2.3 | Final application deadline of the competition | done | date + countdown (Baku time) |
| R2.4 | Comparison of selected areas | done | "Müqayisəyə əlavə et" on map card and area page (max 3), tray, `/compare?codes=` side by side with mini maps |
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
| R6.1 | API readiness: data exchange interface or a working simulation | partial | `ektis-mock/` skeleton |
| R6.2 | Data model for entrepreneur, farm area, competition, application | partial | `api/app/modules/*/models.py`, migration 0002 |
| R6.3 | Security: user roles, access rights, personal-data protection | partial | roles, ownership (404 for others), masking, audit of views/downloads, upload checks |
| R6.4 | Modular architecture | partial | `api/app/modules/` layout |
| R6.5 | Documentation: API examples, data schema, integration approach | partial | Swagger on both services |
| R6.6 | No connection to the real EKTIS; switchable client via config | partial | `EKTIS_MODE` in `.env.example` |

## Demonstration [PDF §3]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R7.1 | Demonstrate functionality | todo | `docs/demo-script.md` |
| R7.2 | Demonstrate ease of use | todo | |
| R7.3 | Demonstrate data security | todo | |
| R7.4 | Demonstrate future development possibilities | todo | `docs/roadmap.md` |

## Delivery package [PDF §9]

| ID | Deliverable | Status | Where |
|---|---|---|---|
| D1 | Working portal prototype | done | `docker compose up` / `scripts/start.ps1` |
| D2 | Catalogue of investment areas and search | done | `/catalogue`, `/map`, search |
| D3 | Electronic application creation and status tracking | done | wizard, cabinet, notifications |
| D4 | Initial version of the admin panel | done | applications, competitions (maker-checker), areas, statistics |
| D5 | Database structure / data model | todo | `docs/data-model.md` |
| D6 | API and integration concept | todo | `docs/integration.md` |
| D7 | Source code and technical documentation | partial | this repository |
| D8 | Installation and launch instructions | partial | `README.md` |
| D9 | Technical roadmap | todo | `docs/roadmap.md` |

## Our additions [OURS]

| ID | Addition | Status |
|---|---|---|
| O1 | Suitability score per farm area (GIS MCDA, AHP weights, FAO classes) | todo |
| O2 | EKTIS mock with outbox, retry and a visible integration log | todo |
| O3 | Maker-checker roles (Mütəxəssis / Rəhbər) | done |
| O4 | Real geography from OpenStreetMap, curated Azerbaijani names only; land outline and Caspian shoreline from the OSM coastline (Absheron included) | partial |
| O5 | Demining status as a hard publishing constraint (synthetic, labelled) | done |
| O6 | Personal-data consent, FİN/VÖEN masking, audit log | partial |
| O7 | Downloadable application receipt (PDF) | todo |
| O8 | Competition-specific required-documents list | done |
| O9 | Public transparency statistics | partial |
| O10 | AZ/EN language toggle | todo |

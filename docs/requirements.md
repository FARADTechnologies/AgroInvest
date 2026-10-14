# Requirements traceability

Every requirement from the technical task has an ID. Status values:
`todo` · `partial` · `done` · `demo-ready` (works on a fresh `docker compose up`, offline).

Tags: **[PDF]** stated in the task · **[INTERP]** our reading of something the task implies · **[OURS]** our addition.

## Module 1: Agrarian investment map [PDF §4.1]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R1.1 | Farm areas offered in Karabakh shown on a map | todo | |
| R1.2 | Location, size and designated purpose per area | todo | |
| R1.3 | Filter by əkinçilik / heyvandarlıq / bağçılıq / digər | todo | |
| R1.4 | Detailed information page per area | todo | |

## Module 2: Investment opportunities catalogue [PDF §4.2]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R2.1 | List of areas put up for competition | todo | |
| R2.2 | Dimensions, location and conditions of use (istifadə şərtləri) | todo | |
| R2.3 | Final application deadline of the competition | todo | |
| R2.4 | Comparison of selected areas | todo | |
| R2.5 | Search capability (§9 "axtarış imkanı") | todo | |

## Module 3: Electronic application [PDF §4.3]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R3.1 | Account creation and login | todo | |
| R3.2 | Entrepreneur or company data (FİN / VÖEN) | todo | |
| R3.3 | Select the farm area | todo | |
| R3.4 | Investment and business plan data | todo | |
| R3.5 | Attach required documents | todo | |
| R3.6 | Register the application and generate its number | todo | |

## Module 4: Application tracking [PDF §4.4]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R4.1 | List of applications | todo | |
| R4.2 | Statuses Qəbul edilib, Baxılır, Əlavə məlumat tələb olunur, Qərar verilib | todo | |
| R4.3 | Application history | todo | |
| R4.4 | Notifications for the user | todo | |

## Module 5: Administrative panel [PDF §4.5]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R5.1 | Add and edit farm areas | todo | |
| R5.2 | Create and manage competitions with an approval mechanism | todo | |
| R5.3 | View incoming applications | todo | |
| R5.4 | Change application status | todo | |
| R5.5 | Statistics and reports (dashboard + export) | todo | |

## EKTIS integration [PDF §5, "the most important technical part"]

| ID | Requirement | Status | Where |
|---|---|---|---|
| R6.1 | API readiness: data exchange interface or a working simulation | partial | `ektis-mock/` skeleton |
| R6.2 | Data model for entrepreneur, farm area, competition, application | todo | |
| R6.3 | Security: user roles, access rights, personal-data protection | todo | |
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
| D1 | Working portal prototype | todo | |
| D2 | Catalogue of investment areas and search | todo | |
| D3 | Electronic application creation and status tracking | todo | |
| D4 | Initial version of the admin panel | todo | |
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
| O3 | Maker-checker roles (Mütəxəssis / Rəhbər) | todo |
| O4 | Real geography from OpenStreetMap, curated Azerbaijani names only | todo |
| O5 | Demining status as a hard publishing constraint (synthetic, labelled) | todo |
| O6 | Personal-data consent, FİN/VÖEN masking, audit log | todo |
| O7 | Downloadable application receipt (PDF) | todo |
| O8 | Competition-specific required-documents list | todo |
| O9 | Public transparency statistics | todo |
| O10 | AZ/EN language toggle | todo |

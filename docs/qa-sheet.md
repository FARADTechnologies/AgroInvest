# Q&A sheet

Short answers to the questions the jury is likely to ask. Each answer points to where it can be
shown in the portal.

**How does this integrate with EKTIS for real?**
Through the Electronic Government Information System (EHİS), with the authority's consent. The
portal depends on an `EktisClient` interface; the mock and a production client implement the same
contract (`docs/ektis-v1.openapi.yaml`). Switching is configuration (`EKTIS_MODE`,
`EKTIS_BASE_URL`, credentials). See `docs/integration.md`, `/admin/integration`.

**What happens if EKTIS is down when a decision is made?**
Nothing is lost. The decision and its EKTIS message are written in one transaction (outbox); a
worker retries after 5, 10, 20 and then every 30 seconds, and a specialist can resend. Retries are
idempotent: EKTIS returns the original receipt. Demo: "Nasazlığı simulyasiya et".

**Why Python and Java?**
The portal API is Python (FastAPI) because the GIS and data work is Python and it is fast to
build; the EKTIS side is Java (Spring Boot) to show the integration as a separate system with an
OpenAPI contract, the way enterprise state systems are built. Both talk plain REST/JSON, so either
side can be replaced.

**Who decides? Is an algorithm allocating land?**
People decide. The specialist changes statuses with a reason; a supervisor approves competitions
and cannot approve their own; the commission decides winners. Suitability and the compare ranking
are decision support, labelled as such, with every factor and weight visible.

**Why no AI / machine learning?**
There is no data on how past allocations performed, so a model could only imitate. We use
transparent methods (GIS multi-criteria analysis with AHP, TOPSIS) whose every number can be
explained and checked.

**How is personal data protected?**
Consent at registration (personal data law); FİN/VÖEN masked in lists, screens and Excel; the full
value only with a reason, and that access is audited; every view and download of an application
is audited; Argon2id passwords; httpOnly SameSite cookies; account lockout and per-address limits;
uploads checked by content and stored outside the web root; secrets only in environment variables.
Applicants only see their own data (others return "not found").

**Where does the map data come from? Why only some village names?**
OpenStreetMap (ODbL). We show only Azerbaijani names (`name:az`) and our curated rayon list,
never the generic `name` tag and no foreign labels; everything outside Azerbaijan is masked.
Villages without an Azerbaijani name in OSM are not labelled rather than shown wrongly.

**Is the demining status real?**
No. It is demo data and labelled as such. In the pilot it comes from ANAMA. The rule is real: a
plot that is not cleared cannot be put into a competition and scores "N" for suitability.

**Are the plots real?**
46 of 61 are real agricultural polygons from OpenStreetMap; 15 are generated near real villages
where OSM is thin. Terms, competitions and applicants are illustrative.

**Does it scale?**
The API is stateless; several replicas can run behind the gateway (the outbox uses `FOR UPDATE
SKIP LOCKED`). PostgreSQL/PostGIS handles the spatial work with indexes. For production: managed
database with backups, object storage for documents, shared rate limits (Redis).

**Does it work without internet?**
Yes. Everything runs locally from one command; the map falls back to an offline basemap served
from our own database (`/map?offline=1`). Only the satellite view needs the internet.

**How do you add a new region or plot?**
A specialist adds a plot from a GeoJSON file (`/admin/areas/new`); size, rayon, nearest village
and suitability are computed on the server. New rayons are data (`seed/reference/rayons.csv`
and boundaries), not code.

**What would the next 4–8 weeks look like?**
Audit and requirements, then EKTIS via EHİS, ASAN Login/İmza and ANAMA data, then a pilot with
production infrastructure. See `/about` and `docs/roadmap.md`.

**How was the work split in the team?**
Answer with each person's real part: project lead and analysis (process map, user needs),
UI/UX, research and test data, QA and demo rehearsal; development of the portal, GIS pipeline and
EKTIS integration.

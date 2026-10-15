# Technical roadmap

The PDF (§6) plans a 4–8 week period after the hackathon: a technical audit of the winning
prototype, clarification of requirements with the Ministry's specialists, an analysis of
security, data model and integration, and a separate technical plan for the pilot. This roadmap
follows that structure. The same plan is shown in the portal on `/about`.

## What the prototype is, honestly

| Real | Demo or simplified |
|---|---|
| Application workflow, state machine, maker-checker approval, notifications, history | Competitions, applications and people are fictional |
| Roles, ownership checks, masking, audit log, upload checks, rate limits | Sign-in is e-mail and password, not ASAN Login |
| Geography from OpenStreetMap (rayons, villages, roads, water, 46 of 61 plots; see `docs/data-sources.md`) | 15 plots are generated near real villages; lease terms and minimum investments are illustrative |
| Suitability method (GIS distances, AHP weights with an expert editor, FAO classes) | Soil, climate and terrain factors are synthetic demo values until SoilGrids, WorldClim and the DEM are sampled |
| Sahibkars place listings, investors set preferences and apply | Listings are published at once; a moderation step would be agreed with the Ministry |
| EKTIS contract, outbox, retries, idempotency, integration log | EKTIS is a mock; demining status is synthetic |

## Ideas for later (not built)

* **Investor demand listings.** An investor publishes what they look for (purpose, region, size,
  budget, must-have features such as irrigation or road access) and sahibkars with matching land
  respond to it. The matching would reuse the catalogue filters and the suitability scores.

## Weeks 1–2: audit and requirements

* Technical audit: code review, dependency and container scan, penetration test of the
  authentication, authorisation and upload paths; test coverage report.
* Requirements with the Ministry: competition rules (eligibility, scoring criteria, appeal),
  lease terms by purpose and region, the official list of documents, who approves what.
* Walk the process map (`/about`) with the specialists who run competitions today; adjust states,
  reasons and notifications.
* Confirm the region scope (Karabakh and East Zangezur economic regions) and the official
  administrative boundaries; decide how disputed or unverified units are shown.

## Weeks 3–5: integrations

* **EKTIS** via the Electronic Government Information System (EHİS), with the authority's
  consent: agree the contract (starting from `docs/ektis-v1.openapi.yaml`), implement the
  production `EktisClient`, add the callback with HMAC signatures (`EKTIS_HMAC_SECRET` is already
  provisioned), and parcel import so plots come from the official register instead of GeoJSON.
* **Identity**: ASAN Login for sign-in, ASAN İmza to sign the application; the FİN/VÖEN then come
  from the identity provider instead of being typed.
* **Data sources**: ANAMA for demining status and certificates; official parcel and land-use
  data; Azərkosmos or a licensed provider for satellite imagery (the prototype uses EOxCloudless,
  CC BY-NC-SA, which is not for production).

## Weeks 6–8: pilot

* Infrastructure: managed PostgreSQL/PostGIS with backups and point-in-time recovery, object
  storage for documents with virus scanning, two or more stateless API replicas (the outbox already
  uses `SKIP LOCKED`), rate limits in a shared store (Redis), TLS at the gateway, monitoring and
  alerting, log shipping.
* Security: hash-chained audit log (columns reserved), a records-retention policy, a data
  protection impact assessment under the personal data law, regular access reviews.
* Product: e-mail and SMS notifications, a scoring matrix for the competition commission
  (decision support, the commission still decides), document versions in the UI, English and
  Russian interfaces, an accessibility audit (WCAG 2.1 AA), a public transparency page.
* Suitability: slope and elevation from a DEM, soil data, validation of weights with agronomists.
* Load test with realistic competition peaks; a pilot with one competition in one rayon.

## Effort and team (indicative)

A pilot team of five (backend, frontend, GIS/data, QA, analyst) for eight weeks, with the
Ministry's specialists available for requirement sessions and acceptance.

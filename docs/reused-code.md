# Reused code, libraries and data

## Our earlier projects

Two earlier projects of the team (GeoInvest and UrbanGeoAI) were reviewed before starting. No
modules were copied. A few patterns were reused and rewritten for this portal:

* the shape of the Docker Compose file with a PostGIS health check;
* the async SQLAlchemy session factory;
* a validation result type (finding with a severity);
* the CI job that checks the repository for files that must not be committed;
* map interaction ideas (hover tooltip, click card, memoised data).

Their authentication, map stack (H3, deck.gl, Google Maps), analytics and branding were not used.

## Libraries

| Area | Libraries | Licence |
|---|---|---|
| API | FastAPI, Starlette, Pydantic, SQLAlchemy, Alembic, GeoAlchemy2, asyncpg, httpx, argon2-cffi, PyJWT, openpyxl, Shapely | MIT / BSD / Apache-2.0 |
| EKTIS mock | Spring Boot, springdoc-openapi | Apache-2.0 |
| Web | Next.js, React, TanStack Query, openapi-fetch, Radix UI, Tailwind CSS, lucide, sonner | MIT / ISC |
| Map | MapLibre GL JS, react-map-gl | BSD-3-Clause / MIT |
| GIS pipeline | GeoPandas, pyogrio (GDAL), NumPy, pandas | BSD / MIT |
| Database and gateway | PostgreSQL, PostGIS, nginx | PostgreSQL / GPL-2.0 / BSD-2-Clause |
| Fonts | IBM Plex Sans and Mono | SIL OFL 1.1 (texts in `web/src/fonts`) |

## Data

| Data | Source | Licence |
|---|---|---|
| Boundaries, villages, farmland, roads, water, coastline | OpenStreetMap via the Geofabrik extract | ODbL 1.0, © OpenStreetMap contributors |
| Satellite imagery (online only) | Esri World Imagery (Maxar, Earthstar Geographics) | Esri terms of use, credited on the map; replace with a licensed source for production |
| Online basemap | CARTO Positron (no labels) | © CARTO, © OpenStreetMap contributors |
| Competitions, applications, people, terms, demining status | written for the demo | fictional |

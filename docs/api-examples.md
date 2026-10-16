# API examples

The portal API is REST with JSON, documented as OpenAPI at **`/api/v1/docs`** (Swagger UI,
through the gateway: `http://localhost:3000/api/v1/docs`). Errors are RFC 9457 problem details
with a stable `title` code and an Azerbaijani `detail`. Times are UTC (ISO 8601); the UI shows
Baku time. Identifiers and codes are ASCII (`CROP`, `RECEIVED`, `AGM-0001`).

The examples use `curl` against the gateway; the demo password is `Demo2026!`. A browser uses
an httpOnly session cookie; API clients can use a bearer token instead.

```bash
BASE=http://localhost:3000/api/v1
```

## Public catalogue

```bash
# Farm areas: purpose filter, size, financial terms, search (diacritics optional, typos tolerated)
curl "$BASE/areas?purpose=LIVESTOCK&min_ha=20&fee_max=30&q=agdam&sort=area_desc&size=10"

# The same filters as GeoJSON for a map
curl "$BASE/areas/geojson?purpose=ORCHARD&open_only=true"

# One area: terms, competition, required documents, suitability with its factor breakdown
curl "$BASE/areas/AGM-0001"

# Compare up to four areas, and rank them for an activity (TOPSIS, decision support)
curl "$BASE/areas/compare?codes=AGM-0001,XVD-0001,CAB-0005"
curl -X POST "$BASE/areas/compare/rank" -H 'Content-Type: application/json' \
  -d '{"codes":["AGM-0001","XVD-0001","CAB-0005"],"activity":"CROP","preset":"balanced"}'

# Published competitions
curl "$BASE/competitions"
```

Response excerpt of `GET /areas/AGM-0001` (deadlines depend on when the demo data was loaded):

```json
{
  "code": "AGM-0001",
  "purpose": "CROP",
  "area_ha": "270.24",
  "competition": {"number": "MS-2026-001", "deadline_at": "2026-11-04T20:00:00Z", "is_open": true},
  "min_investment_azn": "680000.00",
  "suitability": [
    {"activity": "CROP", "score": 62, "fao_class": "S2", "constraint_reason": null,
     "factors": {"water": {"label": "Suvarma mənbəyinə məsafə", "value": 4.1, "unit": "km",
                           "membership": 0.0, "weight": 0.376}, "_cr": 0.007, "_method": "mcda-1"}}
  ]
}
```

## Sign in

```bash
# Cookie session (what the browser does)
curl -c jar -H 'Content-Type: application/json' \
  -d '{"email":"investor@agro-demo.test","password":"Demo2026!"}' "$BASE/auth/login"

# Bearer token for API clients and Swagger
TOKEN=$(curl -s -d 'username=mutexessis@agro-demo.test&password=Demo2026!' "$BASE/auth/token" | jq -r .access_token)
curl -H "Authorization: Bearer $TOKEN" "$BASE/auth/me"
```

Five failed sign-ins lock an account for ten minutes (`423`); many failures from one address
return `429` with `Retry-After`.

## Apply (entrepreneur)

```bash
# Check your own FİN/VÖEN in the EKTIS farmer registry (informative)
curl -b jar -X POST "$BASE/me/entrepreneur/ektis-check"

# Start a draft for a plot in an open competition
APP=$(curl -s -b jar -H 'Content-Type: application/json' -d '{"area_code":"AGM-0001"}' "$BASE/applications" | jq -r .id)

# Business plan
curl -b jar -X PATCH -H 'Content-Type: application/json' "$BASE/applications/$APP" -d '{
  "activity": "CROP", "project_title": "Suvarılan taxıl təsərrüfatı",
  "business_plan": {"investment_azn": 750000, "jobs_planned": 18, "implementation_months": 24,
                    "summary": "Damcı suvarma ilə buğda və qarğıdalı"}}'

# Documents: the type is checked from the file content, not the name
curl -b jar -F doc_type_code=BUSINESS_PLAN -F file=@plan.pdf "$BASE/applications/$APP/documents"

# Submit: completeness and deadline are checked, the number QIM-YYYY-NNNNNN is assigned
curl -b jar -X POST "$BASE/applications/$APP/submit"

# Track: status, history with reasons, notifications
curl -b jar "$BASE/applications/$APP"
curl -b jar "$BASE/notifications"
```

## Review (specialist)

```bash
H="Authorization: Bearer $TOKEN"
curl -H "$H" "$BASE/admin/applications?status=RECEIVED&q=AGM"      # FİN/VÖEN masked
curl -H "$H" -X POST "$BASE/admin/applications/$APP/transitions" \
  -H 'Content-Type: application/json' -d '{"to":"UNDER_REVIEW"}'
curl -H "$H" -X POST "$BASE/admin/applications/$APP/transitions" \
  -H 'Content-Type: application/json' \
  -d '{"to":"INFO_REQUESTED","reason":"Bank arayışını əlavə edin","requested_doc_types":["FINANCIAL_CAPACITY"]}'
curl -H "$H" -X POST "$BASE/admin/applications/$APP/transitions" \
  -H 'Content-Type: application/json' -d '{"to":"DECIDED","outcome":"WON","reason":"Ən yüksək bal"}'

# Full identifier only with a reason; the access is audited
curl -H "$H" -X POST "$BASE/admin/applications/$APP/identifier" \
  -H 'Content-Type: application/json' -d '{"reason":"VÖEN şəhadətnaməsi ilə tutuşdurma"}'
```

An invalid move returns `409 invalid_transition`; a second winner for the same plot returns
`409 winner_exists`.

## EKTIS integration (staff)

```bash
curl -H "$H" "$BASE/admin/integration/status"     # connection, fault, queue counts
curl -H "$H" "$BASE/admin/integration/outbox"     # messages for EKTIS
curl -H "$H" "$BASE/admin/integration/log"        # every call with X-Request-ID
curl -H "$H" -X POST "$BASE/admin/integration/fault" -H 'Content-Type: application/json' -d '{"mode":"DOWN"}'
```

## EKTIS mock (server laptop only)

```bash
KEY=$(grep ^EKTIS_API_KEY= .env | cut -d= -f2)
curl -H "X-API-Key: $KEY" "http://localhost:8081/ektis/v1/farmers?voen=1905832207"
curl -H "X-API-Key: $KEY" "http://localhost:8081/ektis/v1/_mock/inbox"
```

## Reports and statistics

```bash
curl -H "$H" "$BASE/admin/stats"
curl -H "$H" -o applications.xlsx "$BASE/admin/reports/applications.xlsx"   # identifiers masked
curl "$BASE/stats/public"                                                 # aggregates only
```

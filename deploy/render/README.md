# Deploying to Render (free plan)

The repository root holds a Render Blueprint, [`render.yaml`](../../render.yaml), that creates
the whole portal in one go:

| Service | What it is |
|---|---|
| `farad-agro-db` | PostgreSQL 16 with PostGIS |
| `farad-agro-api` | FastAPI (Docker). On start it runs the migrations and loads the seed data and demo accounts into an empty database |
| `farad-agro-web` | Next.js. The browser only talks to this site; `/api` is proxied to the API |

## First deploy

1. Sign in at [dashboard.render.com](https://dashboard.render.com) with GitHub.
2. **New → Blueprint**, pick the `FARADTechnologies/Agro` repository (grant Render access to it
   if asked), leave the branch on `main`, and press **Apply**.
3. Wait until all three resources are live (the first build takes 5–10 minutes).
4. Open the API service and check its address. If it is not
   `https://farad-agro-api.onrender.com` (Render adds a suffix when a name is taken), open the
   **web** service → **Environment**, set `API_INTERNAL_URL` to the API's address and choose
   **Save, rebuild and deploy**.
5. Open the web service's `onrender.com` address and sign in with a demo account
   (password `Demo2026!`, see the main README).

The live instance (`farad-agro`) is linked as a *public* repository, so pushes do **not**
redeploy on their own: after pushing to `main`, open each service and choose
**Manual Deploy → Deploy latest commit** (or connect the GitHub account under
**Account settings → Git**, after which pushes redeploy automatically).

Live addresses: site <https://farad-agro-web.onrender.com>, API
<https://farad-agro-api.onrender.com/api/v1/docs>.

## Limits of the free plan

- Services sleep after 15 minutes without traffic; the first request afterwards takes about a
  minute. If the first page shows an error, reload once the API has woken up.
- The free Render database **expires 30 days after creation**. To keep the data, use a free
  [Neon](https://neon.tech) database instead (no expiry, PostGIS included): create a project,
  copy its connection string, and set it as `DATABASE_URL` on the API service. Both
  `postgres://…?sslmode=require` and `postgresql+asyncpg://…` forms are accepted. The API
  migrates and seeds the new database on its next start.
- Uploaded documents are stored on the API's local disk, which is wiped on every restart.
  Applications and their history stay in the database.

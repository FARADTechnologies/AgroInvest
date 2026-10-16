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
2. **New → Blueprint**, pick this repository (grant Render access to it
   if asked), leave the branch on `main`, and press **Apply**.
3. Wait until all three resources are live (the first build takes 5–10 minutes).
4. Open the API service and check its address. If it is not
   `https://farad-agro-api.onrender.com` (Render adds a suffix when a name is taken), open the
   **web** service → **Environment**, set `API_INTERNAL_URL` to the API's address and choose
   **Save, rebuild and deploy**.
5. Open the web service's `onrender.com` address and sign in with a demo account
   (password `Demo2026!`, see the main README).

## Automatic deploys and backend sync (one-time setup)

Two repository secrets (GitHub → this repository → **Settings → Secrets and variables →
Actions → New repository secret**) switch on the automation:

| Secret | Where to get it | What it enables |
|---|---|---|
| `RENDER_DEPLOY_HOOK_API` | Render → `farad-agro-api` → **Settings → Deploy Hook** → copy | CI deploys the API after every green push to `main` |
| `RENDER_DEPLOY_HOOK_WEB` | Render → `farad-agro-web` → **Settings → Deploy Hook** → copy | the same for the web app |

Without the hook secrets, deploy by hand: open each service (API first) and choose
**Manual Deploy → Deploy latest commit**.

Live addresses: site <https://farad-agro-web.onrender.com>, API
<https://farad-agro-api.onrender.com/api/v1/docs>.

## AI assistant (Aqrar köməkçi)

The plot-finding assistant (the button at the bottom right of the portal) runs on the web
service and calls OpenRouter. Render → `farad-agro-web` → **Environment** → add
`OPENROUTER_API_KEY` (from openrouter.ai → Keys) and save; Render redeploys. The model is
`OPENROUTER_MODEL` (default `anthropic/claude-haiku-5.5`). The key never reaches the browser
and must never be committed. Each visitor address may ask 30 questions per 10 minutes.

## Keeping the services awake

`.github/workflows/keep-alive.yml` runs on GitHub, independent of any computer: one job pings
the API and the site every 10–12 minutes (random), before the 15-minute sleep, and the hourly
schedule queues the next job so there is no gap. It runs only while the repository is public
(free Actions minutes). The repository variable `KEEP_ALIVE_HOURS` (**Settings → Secrets and
variables → Actions → Variables**) sets the Baku-time window, default `8-20`. The free plan's
750 instance hours a month cover two services for about 12 hours a day; `0-24` needs a paid
plan, otherwise Render suspends both services for the rest of the month.

## Limits of the free plan

- Outside the keep-alive window the services sleep after 15 minutes without traffic; the first
  request afterwards takes about a minute. If the first page shows an error, reload once the
  API has woken up.
- The free Render database **expires 30 days after creation**. To keep the data, use a free
  [Neon](https://neon.tech) database instead (no expiry, PostGIS included): create a project,
  copy its connection string, and set it as `DATABASE_URL` on the API service. `deploy/render/start.sh`
  turns Neon's `postgres://…?sslmode=require&channel_binding=require` form into what the API expects. The API
  migrates and seeds the new database on its next start.
- Uploaded documents are stored on the API's local disk, which is wiped on every restart.
  Applications and their history stay in the database.

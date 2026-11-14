# infra/

**Owner:** Nuri (also owns `.github/`).

**Purpose:** deployment and hosting: container files, asset hosting for `assets_base`, dev scripts
that start all services. CI lives in `.github/workflows/`.

**Files:** `docker-compose.yml` (planner :8000, mission-control :8080, Caddy :80/:443),
`Caddyfile` (`API_HOST` → planner, `MC_HOST` → mission-control incl. WebSocket, `ASSETS_HOST` →
file server on `/srv/assets` with CORS for `WEB_ORIGIN`), `.env.example`, `deploy.sh`.
`.github/workflows/deploy.yml` runs `deploy.sh` over SSH on pushes to main that touch
`planner/`, `mission-control/` or `infra/`.

**Run on the server:** `cp infra/.env.example infra/.env`, fill it in, then `sh infra/deploy.sh`.

**Run on a laptop:** `docker compose -f infra/docker-compose.yml up -d --build`. Without an
`.env` the hosts are `api.localhost`, `mc.localhost`, `assets.localhost` (Caddy's local CA;
trust it or use the loopback ports 8000 and 8080) and the assets are `contracts/fixtures/`
(SYNTHETIC).

**Test:** `docker compose -f infra/docker-compose.yml config -q` (syntax), then `/health` on
both hosts and a `wss://<MC_HOST>/ws` connection.

**Must not touch:** service code. Secrets never go in git; use `.env` (git-ignored) and CI secrets.

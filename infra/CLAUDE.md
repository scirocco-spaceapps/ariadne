# infra/

**Owner:** Nuri (also owns `.github/`).

**Purpose:** deployment and hosting: container files, asset hosting for `assets_base`, dev scripts
that start all services. CI lives in `.github/workflows/`.

**Files:** `docker-compose.yml` (planner :8000, mission-control :8080, Caddy :80/:443),
`Caddyfile` (`API_HOST` → planner, `MC_HOST` → mission-control incl. WebSocket, `ASSETS_HOST` →
file server on `/srv/assets` with CORS for `WEB_ORIGIN`, plus the repo's `content/` read-only at
`/content/` for stop photos; only existing files get the 1 h cache, 404s are `no-store`),
`.env.example`, `deploy.sh`.
`.github/workflows/deploy.yml` runs `deploy.sh` over SSH on pushes to main that touch
`planner/`, `mission-control/` or `infra/`.
`.github/workflows/web-deploy.yml` publishes `web/` to Vercel production on pushes to main that
touch `web/`, `contracts/` or `content/` (prebuilt via the Vercel CLI; needs the `VERCEL_TOKEN`
secret; Actions → web-deploy → Run workflow redeploys by hand).

**Run on the server:** `cp infra/.env.example infra/.env`, fill it in, then `sh infra/deploy.sh`.

**Run on a laptop:** `docker compose -f infra/docker-compose.yml up -d --build`. Without an
`.env` the hosts are `api.localhost`, `mc.localhost`, `assets.localhost` (Caddy's local CA;
trust it or use the loopback ports 8000 and 8080) and the assets are `contracts/fixtures/`
(SYNTHETIC).

**Laptop hosting until the real server (free):** `cp infra/laptop.env.example infra/.env.laptop`,
fill in `NASA_API_KEY`, then `sh infra/funnel.sh` (`sh infra/funnel.sh down` to stop). It runs the
stack with `docker-compose.laptop.yml` (loopback ports only) and exposes it with Tailscale Funnel:
mission-control on `https://<node>.ts.net:8443`, assets on `:10000/`, planner on `:10000/planner`.
Port 443 is not used: a local k3s Traefik takes it. One-time setup: Funnel enabled for the node in
the Tailscale admin console and `sudo tailscale set --operator=$USER`. The laptop must stay awake.

**Test:** `docker compose -f infra/docker-compose.yml config -q` (syntax), then `/health` on
both hosts and a `wss://<MC_HOST>/ws` connection.

**Must not touch:** service code. Secrets never go in git; use `.env` (git-ignored) and CI secrets.

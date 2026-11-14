# infra/

**Owner:** Nuri (also owns `.github/`).

**Purpose:** deployment and hosting: container files, asset hosting for `assets_base`, dev scripts
that start all services. CI lives in `.github/workflows/`.

**Files:** `docker-compose.yml` (planner :8000, mission-control :8080, Caddy :80/:443),
`Caddyfile` (`API_HOST` → planner, `MC_HOST` → mission-control incl. WebSocket, `ASSETS_HOST` →
file server on `/srv/assets` with CORS for `WEB_ORIGIN`, plus the repo's `content/` read-only at
`/content/` for stop photos; only existing files get the 1 h cache, 404s are `no-store`),
`.env.example`, `deploy.sh`.
`.github/workflows/deploy.yml` runs `deploy.sh` over SSH on the server on pushes to main that touch
`planner/`, `mission-control/` or `infra/` (Markdown files excluded). That restarts the services,
and mission-control keeps sessions in memory, so open sessions drop: no merges to those folders
during the demo, the video recording or judging.
`.github/workflows/web-deploy.yml` publishes `web/` to Vercel production on pushes to main that
touch `web/`, `contracts/` or `content/` (prebuilt via the Vercel CLI; needs the `VERCEL_TOKEN`
secret; Actions → web-deploy → Run workflow redeploys by hand). A new deploy can break lazy loads
(stop cards) in pages opened before it until they reload, so no merges to those folders during the
demo, the video recording or judging either.

**Server (live since 2026-11-14, see DECISIONS.md):** Hetzner CX23 at 2.31.2.199,
`ssh deploy@2.31.2.199`, checkout `~/ariadne`. Hosts `https://api.2-31-2-199.sslip.io` (planner),
`https://mc.2-31-2-199.sslip.io` (mission-control, `/ws`), `https://assets.2-31-2-199.sslip.io/`
(assets); Vercel production's three `VITE_*` values point to them. First setup:
`cp infra/.env.example infra/.env`, fill it in, then `sh infra/deploy.sh`. Do not edit files on
the server except `infra/.env`: `deploy.sh` runs `git pull` and local changes break it.

**New asset bundle** (goes to the server, not a laptop):
```sh
scp ariadne-assets-XXXX.zip deploy@2.31.2.199:/tmp/
ssh deploy@2.31.2.199
rm -rf /srv/assets/bright-angel && unzip -o /tmp/ariadne-assets-*.zip -d /srv/assets
cd ~/ariadne && docker compose -f infra/docker-compose.yml --env-file infra/.env restart planner
```

**Run on a laptop:** `docker compose -f infra/docker-compose.yml up -d --build`. Without an
`.env` the hosts are `api.localhost`, `mc.localhost`, `assets.localhost` (Caddy's local CA;
trust it or use the loopback ports 8000 and 8080) and the assets are `contracts/fixtures/`
(SYNTHETIC).

**Laptop fallback (Tailscale Funnel; it was the host until the server):** to fall back, run it,
switch the three Vercel production `VITE_*` values to the Funnel URLs and redeploy web. Setup:
`cp infra/laptop.env.example infra/.env.laptop`, fill in `NASA_API_KEY`, then `sh infra/funnel.sh` (`sh infra/funnel.sh down` to stop). It runs the
stack with `docker-compose.laptop.yml` (loopback ports only) and exposes it with Tailscale Funnel:
mission-control on `https://<node>.ts.net:8443`, assets on `:10000/`, planner on `:10000/planner`.
Port 443 is not used: a local k3s Traefik takes it. One-time setup: Funnel enabled for the node in
the Tailscale admin console and `sudo tailscale set --operator=$USER`. The laptop must stay awake.

**Test:** `docker compose -f infra/docker-compose.yml config -q` (syntax), then `/health` on
both hosts and a `wss://<MC_HOST>/ws` connection.

**Must not touch:** service code. Secrets never go in git; use `.env` (git-ignored) and CI secrets.

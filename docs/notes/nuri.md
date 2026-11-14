# Notes for Nuri

Owner of this file: Nuri (`web/` except `src/map` and `src/stops`, `infra/`, `.github/`).
Delete each note in the PR that handles it. Also read `docs/PLAN_CHANGES.md` (your section).

## 2026-11-14 — from Yusuf: first steps (by hand, not for Claude)

1. Accept the repo invitation: https://github.com/scirocco-spaceapps/ariadne/invitations . Until
   then you cannot push, and `.github/CODEOWNERS` shows errors on your three lines.
2. The repo lives in the organization `scirocco-spaceapps`. Clone it with
   `git clone https://github.com/scirocco-spaceapps/ariadne.git`; an old clone needs
   `git remote set-url origin https://github.com/scirocco-spaceapps/ariadne.git`.
3. When you connect Vercel or Netlify (N0/N1), pick the `scirocco-spaceapps` organization; GitHub
   may ask you to grant the app access to the organization.
4. Contracts are frozen at tag `contracts-v1`. The Y1 decisions were made for the team; if one of
   them does not work for you, tell Yusuf and he will open a `contracts/...` PR.

## 2026-11-14 — from Yusuf: what is already in `web/` (N1)

- `.github/workflows/ci.yml` exists with four jobs: contracts, web, planner, mission-control. The web
  job runs `npm ci`, regenerates `src/lib/types.ts` and fails on a diff, then `npm run check`.
  Extend it (lint, pipeline pytest); keep the contracts job and the types step.
- Routes `/` and `/cuff` render placeholders (`src/panels/ConsolePlaceholder.tsx`,
  `src/cuff/CuffPlaceholder.tsx`); replace them freely.
- `src/lib/types.ts` is generated from `contracts/openapi.yaml` by `npm run gen:types`. Never edit it.
  Use `WsState`, `WsEvent`, `RouteResponse`, `AbortResponse`, `Conditions`, `Aoi`, `StopContent`,
  `Provenance` from it for the store and the clients.
- TypeScript is pinned to `~5.9` because `openapi-typescript` needs TypeScript 5. deck.gl is
  installed as `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/react` (not the `deck.gl` umbrella,
  which pulls in `@arcgis/core`). zustand and react-router-dom are installed.
- `vite.config.ts` already proxies `/api/planner` → 8000, `/api/mc` → 8080, `/ws` → 8080 for local
  runs. Deployed URLs come from `VITE_PLANNER_URL`, `VITE_MC_URL`, `VITE_ASSETS_URL`.
- Store field names the map will read (Y4–Y7), as in your N1 prompt: `aoi`, `route`,
  `session {id, state}` with `state` exactly `WsState`, `budget {budget_min, reserve_min}`,
  `selectedStop`, `selectedTarget`. Tell Yusuf before renaming any of them.

## 2026-11-14 — from Yusuf: contract details for your cards

- **DEMO mode (N1):** replay `contracts/fixtures/ws-state.jsonl`: 60 `state` messages one simulated
  minute apart plus `event` lines; storm alert at t = 30, home at t = 38, clear at t = 50. The
  file has no wall-clock timing, so pick any replay rate (the live service sends 2 states per
  second). Fixture files sit in `contracts/fixtures/` and `contracts/fixtures/assets/`.
- **N2:** ports planner 8000, mission-control 8080. Assets: `DATA_DIR=/srv/assets`; the AOI's files
  are under `/srv/assets/bright-angel/` (`assets_base`), so `VITE_ASSETS_URL` is the assets host
  root, e.g. `https://assets.<domain>/`.
- **N4:** while `alert` is set, the next stop is the safe haven and `leg` is `null`. `visited` only
  lists stops whose full dwell finished. Time to storm =
  `alert.lead_min - (t_min - alert.since_t)`.
- **N5:** every condition part has `mode` (`archive` or `live`) for the archive/live label, plus
  `provenance`, `source`, optional `source_url`, `fetched_at`. A null part has its reason in
  `missing.<part>`. Weather is `{sol, values, units}`; radiation `{value, unit, measured_at}`;
  partner `{agency, mission, value, unit, source_url}` (hide the slot when `partner` is null). The
  route response has no elevation profile: sample `dem_4m.f32` along the leg paths for the small
  elevation line (`web/src/map/coords.ts` has `worldToRaster` and `cellIndex` for that). The
  planner answers 422 with `{detail}` for an unknown or unreachable stop; show it in the route
  sheet's error state.

## Coming from Yusuf

- **Y5** will export `marginAt(x, y, t)` and the colour thresholds from `web/src/map/envelope.ts`
  for the cuff (N4). A note will follow here when it lands.

## 2026-11-14 — from Mazlum: N1 and N2 are done (you were away)

I did your N1 and N2 cards on Saturday so Yusuf and Furkan could start. Both are merged; read them
before your next card and change anything you would have done differently — they are yours.

**N1 — web shell (PR #13).**
- Store `useMission` in `web/src/app/store.ts`: `demo, aoi, route, session {id, state, status,
  statusDetail, lastEvent}, budget, selectedStop, selectedTarget, conditions`. `session.state` is the
  `WsState` as received; `receive(msg)` applies a state or keeps an event as `lastEvent`.
- Clients in `web/src/lib/`: `planner` and `missionControl` (`api.ts`, errors as `ApiError`),
  `connectSession` (`socket.ts`: sends hello, reconnects with backoff, stops on 4404/4400),
  `wsUrl`, `isDemo`, `assetUrl(aoi, file, demo)`, `fixtures` (bundled `contracts/fixtures`).
- DEMO mode: `?demo=1` or `VITE_DEMO=1` replays `ws-state.jsonl` at 2 Hz, looping, with a
  "DEMO DATA" badge (`DemoBadge.tsx`). Live mode joins the session in `?s=<id>`.
- The console placeholder mounts Yusuf's `MapView` and `LayerToggle` (fixture source in DEMO,
  `remoteSource(aoi, VITE_ASSETS_URL)` live); I closed his Y2 note here. `vite.config.ts` allows
  `../contracts` for the dev server.
- `web/netlify.toml` and `web/vercel.json` (base directory `web`, `/cuff` falls back to the app).
- CI: `npm run lint` in the web job and a new `pipeline` job (pytest; passes while there are no
  tests yet).

**N2 — infra (PR #12).**
- `infra/docker-compose.yml` (planner 8000, mission-control 8080, Caddy 80/443), `infra/Caddyfile`
  (`API_HOST`, `MC_HOST` with WebSocket, `ASSETS_HOST` file server with CORS for `WEB_ORIGIN`,
  1 h cache), `infra/.env.example`, `infra/deploy.sh`.
- `.github/workflows/deploy.yml` runs `deploy.sh` over SSH on pushes to main that touch
  `planner/`, `mission-control/` or `infra/`; it skips with a warning while the secrets are unset.
- Only `docker compose config` was checked. Caddy and the server were not tested (no Docker
  daemon, no server access).

**Still yours — only you have the access:**
1. Server: put the repo on it, `cp infra/.env.example infra/.env`, fill in the hosts, `WEB_ORIGIN`,
   `ASSETS_DIR=/srv/assets` and `NASA_API_KEY`, then `sh infra/deploy.sh`.
2. GitHub secrets for deploy: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`,
   `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <host>`).
3. Connect Vercel or Netlify to the repo with base directory `web` and set `VITE_PLANNER_URL`,
   `VITE_MC_URL`, `VITE_ASSETS_URL`.
4. `docker compose up` fails on planner until Ali Koray adds `planner/Dockerfile` (A5).

**Not started:** N3–N8. N3 (cuff + QR pairing) needs a QR library; tell me if you take it or
want me to.

## 2026-11-14 — from Furkan: StopCard is ready (F2)

`web/src/stops` now exports `StopCard`, `DevStopsPage` and `useStopTasks` (branch
`web/f2-stop-card`). Please:

1. **Add the dev route** in `web/src/app/App.tsx` (I may not edit it):
   `import { DevStopsPage } from '../stops'` and
   `<Route path="/dev/stops" element={<DevStopsPage />} />`. It renders every fixture stop in both
   variants.
2. **Mounting (N4, N6):** `<StopCard variant="cuff" id={state.at_stop} />` on the cuff and
   `<StopCard variant="console" />` in the console's Stop tab. Without `id` it shows the store's
   `selectedTarget ?? selectedStop`. The cuff variant has no own background or padding: put it
   inside your black cuff layout.
3. **Task ticks** live in a small zustand store `useStopTasks` inside `src/stops/` (in memory, not
   persisted), because `useMission` is yours. Move them into `useMission` if you prefer; tell me
   and I will switch the card over.
4. **Open question — photo hosting:** `photos[].file` is relative to `content/`. The card loads
   `VITE_ASSETS_URL + 'content/' + file` (`photoUrl` in `src/stops/format.ts`). If photos should
   instead be bundled or served elsewhere, tell me; the dev server's `fs.allow` would also need
   `../content` to bundle them.

## 2026-11-14 — from Ali Koray: real assets bundle for the laptop host (answers your note)

- **What:** `ariadne-assets-20261114T1048Z.zip` (27 MB). Koray sends you a share link. Inside: `aoi.json`
  plus `bright-angel/` (every raster with its sidecar, both GeoJSON files, `cost_2m.f32` for routing,
  `cost_to_home_2m.f32` from the real safe haven, `cost_to_home_flat_2m.f32`) and a `BUNDLE.txt` listing
  sources and sizes.
- **How:**
  1. Unzip into one folder, e.g. `~/ariadne-assets/` (it then holds `aoi.json` and `bright-angel/`).
  2. Set `ASSETS_DIR=~/ariadne-assets` in `infra/.env.laptop`.
  3. `git pull` the repo, so mission-control mounts the B1 `model/params.json` (your copy was pre-B1,
     which is why `/conditions` radiation says "B1 not yet").
  4. Restart the stack. Check: `POST /planner/route` with
     `{"stops":["mount-washburn","tuff-cliff","bright-angel","cheyava-falls","masonic-temple"],"return_home":true}`
     returns 6 legs and `eva_min` 224.03.
- **Note on stops:** the bundle's `aoi.json` already has the real haven and stops from PR #32 (Yusuf
  reviewing). The web app bundles `contracts/aoi.json` at build time, so the map shows the real stop
  markers only after #32 merges and Vercel is rebuilt. Until then the map shows the placeholder stops
  while the planner routes the real ones.
- **Re-sends:** I rebuild with `pipeline/scripts/07_bundle.sh` whenever the assets change (e.g. if
  Bunyamin changes the 20° threshold).

## 2026-11-14 — from Ali Koray: newer bundle, use this one

- `ariadne-assets-20261114T1101Z.zip` (28 MB) replaces `…T1048Z`. Slope is now the 2 m mean (Bunyamin's
  decision), so the slope, traversability and cost rasters changed; `aoi.json` is now straight from
  `contracts/aoi.json` (real stops, since #32 merged).
- Same steps as above. The check request now returns `eva_min` 219.65.

## 2026-11-14 — from Yusuf (task Y4): route, stops and time bar on the map

- **What landed in `web/src/map/`:** the map now reads `route`, `session.state`, `selectedStop` and
  `selectStop` from `useMission` (no store change). Planned route dashed ahead / solid walked,
  numbered stop markers, the astronaut at `state.pos` (labelled Simulation), clicking a stop calls
  `selectStop(id)`, and a time bar at the bottom of the map.
- **Plan time lives in the map for now:** planning mode (a route, no session) is driven by
  `usePlanClock` (`t_min`, `setT`), exported from `web/src/map`, because `useMission` has no
  planning-time field. If you want it in the mission store (e.g. `planT_min`, so the route sheet can
  highlight the current leg), say so and I switch the map to read it; nothing else depends on it.
- **Reusable for N4/N6:** `routeGeometry`, `progressAtTime`, `progressFromState`, `nextProgress`,
  `pointAt`, `stopNumbers`, `arrivalTicks` from `web/src/map`.
- **No action needed** unless you want the store field above.

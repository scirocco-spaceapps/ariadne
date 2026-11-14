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

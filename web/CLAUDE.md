# web/

**Owner:** Nuri, except `src/map/` (Yusuf) and `src/stops/` (Furkan).

**Purpose:** Vite + React + TypeScript client. deck.gl for the map, zustand for state.
- `/` — mission console (map, route, timeline, conditions).
- `/cuff` — the astronaut's wrist display.

| Folder | Holds |
|---|---|
| `src/app/` | routing, layout, stores |
| `src/lib/` | API/WS clients, `types.ts` (generated, never hand-edited) |
| `src/map/` | deck.gl layers in local metres (`COORDINATE_SYSTEM.CARTESIAN`), never Web Mercator — Yusuf |
| `src/panels/` | console side panels |
| `src/cuff/` | cuff view |
| `src/stops/` | stop cards and content — Furkan |

**Run:** `cd web && npm install && npm run dev` (http://localhost:5173; proxies `/api/planner` to
8000, `/api/mc` and `/ws` to 8080).

**Test:** `cd web && npm run check` (typecheck, vitest, build).

**Env:** `VITE_PLANNER_URL`, `VITE_MC_URL`, `VITE_ASSETS_URL` (default: the dev proxy and `/`),
`VITE_DEMO=1`. `?demo=1` also turns on DEMO mode: the store replays `contracts/fixtures/`
(SYNTHETIC) and a "DEMO DATA" badge shows. `?s=<id>` joins a live session.

**Shared API for other folders:** `useMission` (store) from `src/app`; `planner`, `missionControl`,
`connectSession`, `assetUrl(aoi, file, demo)`, `fixtures` and the contract types from `src/lib`.

**Deploy:** `netlify.toml` or `vercel.json` (base directory `web`); `/cuff` falls back to the app.

**Types:** `npm run gen:types` regenerates `src/lib/types.ts` from `contracts/openapi.yaml`.

**Rules:** every number on screen shows its provenance badge. UI copy in English.

**Must not touch:** `contracts/`, other services, root config, CI. Inside web, stay in your own
folder (`src/map/`, `src/stops/` belong to their owners).

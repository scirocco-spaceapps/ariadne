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
8000, `/api/mc` and `/ws` to 8080). `npm run dev:lan` also serves on the LAN so a phone on the
same network or hotspot can open it. In live mode the dev server also proxies `/bright-angel` and
`/content` to the local assets host (`infra/funnel.sh`, Caddy on 127.0.0.1:8090).

**Pairing (N3):** the console's "Create session" posts the store's route (the SYNTHETIC fixture
route until the planner is wired in) to mission-control and puts `?s=<id>` in the URL; "Pair cuff"
shows a QR for `/cuff?s=<id>` (`/cuff?demo=1` in DEMO mode). Open the console on the LAN address,
not `localhost`, or the phone cannot reach the QR's URL. The DEMO replay is locked to the wall
clock, so every screen in DEMO mode shows the same frame.

**Link to mission-control (N7, `src/app/link.ts`):**
- **Detection:** while a live session is open, a banner reports a lost link. A running session that sends no frame for 3 s, or `/health` not answering within 4 s, counts as lost.
- **Fallback:** 10 s after the last sign of life the screen switches to the DEMO replay with the DEMO DATA badge, and the socket keeps reconnecting.
- **Recovery:** the first live frame restores the live session.
- **Restart:** if mission-control restarted and lost the session (4404), the console recreates it at the same time, speed and storm alert and updates `?s=`. The cuff shows "scan the new QR".

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

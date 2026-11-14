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
8001, `/api/mc` and `/ws` to 8002).

**Test:** `cd web && npm run check` (typecheck, vitest, build).

**Types:** `npm run gen:types` regenerates `src/lib/types.ts` from `contracts/openapi.yaml`.

**Rules:** every number on screen shows its provenance badge. UI copy in English.

**Must not touch:** `contracts/`, other services, root config, CI. Inside web, stay in your own
folder (`src/map/`, `src/stops/` belong to their owners).

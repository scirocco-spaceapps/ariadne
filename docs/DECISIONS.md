# Decisions

Append-only. Add new entries at the end; never rewrite or delete an existing line. To change a
decision, append a new entry that supersedes it and name the old one.

Format: `YYYY-MM-DD — <decision> — <why> — <who>`

- 2026-11-14 — All services and the web client use one local metric plane: x east, y north, metres from the AOI south-west corner; rasters north-up, row 0 north. No Web Mercator anywhere. — Walking-scale distances and slopes must be exact metres; one frame removes reprojection bugs between teams. — Yusuf
- 2026-11-14 — `crs.proj4` in aoi.json is Mars-sphere equirectangular (`+proj=eqc`, R = 3396190 m) centred on the AOI; used by the pipeline only. — Distortion is negligible over 2.5 km and pyproj supports it directly. — Yusuf
- 2026-11-14 — One `contracts/openapi.yaml` describes both services; each path item has a path-level `servers` entry and a tag naming its service; `/health` is listed once for both. — The brief asks for a single contract file; OpenAPI path keys must be unique. — Yusuf
- 2026-11-14 — Non-HTTP contracts (Aoi, StopContent, WsState, WsEvent, WsHello) are also schemas in openapi.yaml. — One generator (openapi-typescript) produces all web types; one validator checks all fixtures. — Yusuf
- 2026-11-14 — Fixtures use a 500 x 400 m SYNTHETIC AOI with the same keys and pixel sizes as the real AOI. — Keeps fixture rasters under 1 MB in git while exercising the same code paths. — Yusuf
- 2026-11-14 — Missing condition parts are `null`, with the reason in a sibling `missing` map. — Never show an invented value; the UI can always explain why a panel is empty. — Yusuf
- 2026-11-14 — mission-control uses Fiber v2. — Stable release line with the largest set of examples. — Yusuf
- 2026-11-14 — Ports: planner 8001, mission-control 8002, web 5173; web dev server proxies `/api/planner`, `/api/mc`, `/ws`. — Fixed ports let everyone run the stack without config. — Yusuf
- 2026-11-14 — web uses the scoped deck.gl packages (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/react`) instead of the `deck.gl` umbrella. — The umbrella pulls in `@arcgis/core` (~370 packages, with a telemetry postinstall) that we never use. — Yusuf
- 2026-11-14 — web pins TypeScript ~5.9 instead of the Vite template's 7.0. — openapi-typescript 7.13 (type generation from contracts) requires TypeScript 5. — Yusuf
- 2026-11-14 — `traversability_*.png` is 8-bit grey, 255 = easiest, 0 = impassable; `slope_*.png` is RGB coloured by `slope.legend`. — The contract names the files but not the encoding; this fixes it for fixtures and pipeline. — Yusuf
- 2026-11-14 — `AbortResponse` carries `provenance` (in addition to path, time_min, distance_m). — Every value shown to a user carries provenance. — Yusuf
- 2026-11-14 — Supersedes the ports line above: planner listens on 8000, mission-control on 8080 (web 5173 unchanged). — Matches infra/docker-compose in task N2. — Yusuf
- 2026-11-14 — Supersedes the traversability line above: `traversability_*.png` is RGB coloured by three classes (go, caution, no-go) listed in `rasters.traversability.legend`; thresholds come from model/params.json. — Task A3 classifies cells into three classes. — Yusuf
- 2026-11-14 — Condition parts all carry `provenance`, `source`, `mode` (archive or live), optional `source_url` and `fetched_at`. Weather is `{sol, values, units}`; radiation `{value, unit, measured_at}`; partner `{agency, mission, value, unit, source_url}`. — Matches tasks M4, M6, B4 and N5 (archive vs live shown apart). — Yusuf
- 2026-11-14 — planner answers 422 for unknown or unreachable stops and positions outside the AOI; `Error.detail` is a string or FastAPI's validation list. — Task A5 and FastAPI's own 422s share one shape. — Yusuf
- 2026-11-14 — `POST /sessions/{id}/script {name: "demo90"}` is in the contract from v1. — Task M5 and the F4 e2e test need it; adding it now avoids a contract change mid-sprint. — Yusuf
- 2026-11-14 — `vectors.geology` (optional, geology.geojson) added to aoi.json. — Geology is a MUST layer in the game plan; it was missing a slot. — Yusuf
- 2026-11-14 — Placeholder AOI is centred on lon 77.2989 E, lat 18.4889 N (rover position on sol 1250, per the task book); proj4 lat_ts and lon_0 use that centre. — Same centre task A1 crops around; A2 replaces the values with real ones. — Yusuf
- 2026-11-14 — Ideas for later are appended to this file as lines starting `- LATER:` (what, why, hours, who). — The task book's "new idea" rule needs one place for them. — Yusuf
- 2026-11-14 — Y1 contract tour, decided by Yusuf with Claude on the team's request (none of us is an expert here); the list below is contracts-v1. — The team asked for the most sensible defaults so everyone can start; any owner may still object by PR before the tag. — Yusuf
- 2026-11-14 — Deployed hostnames stay out of the contract: openapi `servers` are dev addresses; web reads VITE_PLANNER_URL, VITE_MC_URL, VITE_ASSETS_URL. — Lets us freeze before the domain is known; only env changes when it is. — Yusuf
- 2026-11-14 — `assets_base` is a folder relative to the asset root (`bright-angel/`): web joins VITE_ASSETS_URL, planner and pipeline join DATA_DIR (/srv/assets on the server). — Same file layout on the assets host, the server disk and the fixtures. — Yusuf
- 2026-11-14 — mission-control broadcasts `state` at 2 Hz wall clock while running, plus once after every control, event or script call; clients interpolate. — Task M1's rate, written down so console and cuff agree. — Yusuf
- 2026-11-14 — On storm_alert the astronaut walks `abort_path` with `leg = null`, `at_stop = null`; a dwell cut short is not `visited`; `arrived` at the safe haven stops the clock; `clear` resumes the plan from the current position. — One rule for M3, Y6, N4 and the e2e test. — Yusuf
- 2026-11-14 — `lead_min` is fixed when the alert is raised; time to storm = lead_min - (t_min - since_t). — Task Y6's envelope formula. — Yusuf
- 2026-11-14 — Route legs and abort paths are simplified to at most 300 vertices (schema maxItems). — Task A5's limit; keeps WebSocket frames small at 2 Hz. — Yusuf
- 2026-11-14 — `seek` requires `t_min`; default `speed` is 6 simulated minutes per real second. — Task M2's default, now in the schema. — Yusuf
- 2026-11-14 — Classified PNGs use exactly the legend colours, no anti-aliasing, alpha 0 for no data; every .f32 ships a sidecar {width, height, px_m, min, max}. — Web reads classes by colour; A2 and the fixtures share one sidecar shape. — Yusuf
- 2026-11-14 — Optional raster entries `slope_values` (slope_2m.f32, degrees) and `dem_geotiff` (dem_1m.tif, local CRS) added for notebooks B3 and B4. — They were going to be published but had no contract entry. — Yusuf
- 2026-11-14 — planner's cost_2m.f32 and pred_2m.i32 stay outside the contract, under DATA_DIR. — Only planner reads them; keeping them out avoids freezing planner internals. — Yusuf
- 2026-11-14 — GeoJSON files are FeatureCollections in AOI metres with top-level `provenance` and `source`; waypoints carry `sol` (site, drive optional); targets carry `id, area_m2, distance_m, sol`; geology carries `unit, name`. — Y3, Y7, B3 and A1 write and read the same property names. — Yusuf
- 2026-11-14 — StopContent photos carry `page_url`; every stop carries `sources` (at least one) and an optional `draft` flag; `photos[].file` is relative to content/. — Task F3 cites every photo and science question; B1 reviews drafts. — Yusuf
- 2026-11-14 — `model/params.json` is the source of truth for budget, reserve and dwell; aoi.json `model` is a copy, and contracts/check.py fails when they differ. `speed_vs_slope` is a list of [slope_deg, factor] pairs with linear interpolation. — One value, one place; A3 gets a deterministic function. — Yusuf
- 2026-11-14 — Fixture assets moved from fixtures/rasters/ to fixtures/assets/ and now include SYNTHETIC track, waypoints, targets and slope_2m.f32. — The folder holds GeoJSON as well as rasters; Y3 and Y7 can code against them. — Yusuf
- LATER: move the repo to a GitHub organization if the team wants one — GitHub redirects the old URL, but do it before Vercel or Netlify is connected — 0.25 h — Yusuf
- 2026-11-14 — docs/PLAN_CHANGES.md lists, per task card, every place the repo differs from the task book, game plan and visual brief; root CLAUDE.md points every session to it. Precedence: contracts/ > PLAN_CHANGES.md > task prompt. — Teammates work from the three documents outside the repo. — Yusuf
- 2026-11-14 — pr-ac allows exactly the paths in the card's "Work only inside:" line (plus docs/ai-use/<name>.md) and runs the check of every directory touched. — A6, A7, B1, B2, B4 and F3 work in more than one folder and were blocked by the single-directory rule. — Yusuf
- 2026-11-14 — Notes for other owners go in docs/notes/<owner>.md (anyone appends, the owner deletes handled notes); root CLAUDE.md tells every session to read its own file first; pr-ac allows those appends. Replaces NOTE-for-<owner>.md files. — Notes inside the writer's own folder were invisible to the owner's Claude sessions. — Yusuf

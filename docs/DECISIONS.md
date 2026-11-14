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

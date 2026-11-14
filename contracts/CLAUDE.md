# contracts/

**Owner:** Yusuf. Frozen after tag `contracts-v1`; every change after that is a PR reviewed by Yusuf.

**Purpose:** the single source of truth between directories.
- `aoi.json` — area of interest: extent, CRS, raster/vector files, safe haven, stops, model budget.
- `openapi.yaml` — HTTP API of `planner` and `mission-control`, plus shared schemas (`Aoi`,
  `StopContent`, `WsState`, `WsEvent`, `WsHello`) so one generator types everything.
- `ws-messages.md` — WebSocket protocol of mission-control.
- `fixtures/` — small example payloads and SYNTHETIC assets (rasters, GeoJSON) everyone codes against.

**Run / regenerate fixtures:** `python contracts/tools/make_fixtures.py` (rewrites rasters and
`ws-state.jsonl`; JSON fixtures other than those are hand-made).

**Test:** `pip install -r contracts/requirements.txt && python contracts/check.py`
Validates every fixture against the OpenAPI schemas, raster sizes against `size_m / px_m`,
cross-references between ids, and route totals.

**Must not touch:** anything outside `contracts/`. After a contract change, tell owners to
regenerate (`cd web && npm run gen:types`) rather than editing their code.

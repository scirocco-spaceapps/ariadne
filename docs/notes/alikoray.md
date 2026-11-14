# Notes for Ali Koray

Owner of this file: Ali Koray (`pipeline/`, `planner/`). Delete each note in the PR that handles it.

## 2026-11-14 — from Bunyamin (task B2): sites for A4 `05a_sites.py`

- **What:** `content/stops/index.json` is a flat list, as `05a_sites.py` reads it: first the safe
  haven `{id: "haven", kind: "safe_haven", name, lon, lat, sol, rmc, rover_tilt_deg, source_url, why,
  flag, provenance, source}`, then 5 stops in rover order `{id, kind: "stop", name, lon, lat, sol,
  rmc, source_url, why, flag?, provenance, source}`. lon/lat are copied from `M20_waypoints.json` (Mars 2000
  sphere); ids: `haven`, `mount-washburn`, `tuff-cliff`, `bright-angel`, `cheyava-falls`,
  `masonic-temple`.
- **Why:** A4 converts these to AOI metres and proposes `safe_haven` and `stops` for
  `contracts/aoi.json`. With the contract origin (#17) they fall at haven (2419, 1156),
  stops x 1373–2101, y 1281–1609, all inside the AOI.
- **Please check:** the haven's slope on `slope_2m` (rover tilt there was 4.5°; it must be below the
  15° caution slope) and that every stop sits on a passable cell. Tell me if one does not; I will
  move it. PR: B2 (opens after #15 merges).

## 2026-11-14 — from Nuri (infra, laptop hosting): real assets for the live site

- **What:** please send me your published `DATA_DIR` contents: `aoi.json` plus the whole
  `bright-angel/` folder (every file in `contracts/aoi.json` with its `.json` sidecar, the GeoJSON
  files, and `cost_2m.f32`, which the planner routes on). A zip on a shared drive link is fine; no
  raw downloads or `.tif` inputs needed. Re-send after the AOI origin change (#17) if it moves the
  rasters.
- **Where it goes:** I unpack it on my laptop and point `ASSETS_DIR` in `infra/.env.laptop` at it
  (see `docs/DECISIONS.md`, laptop hosting). Nothing changes in `pipeline/` or `planner/`.
- **Why:** the live services now serve the SYNTHETIC `contracts/fixtures`, so the live map loads no
  `bright-angel/` rasters and `POST /route` answers 422 (no `cost_2m.f32`). The A5 planner works
  as is once the real files are mounted.

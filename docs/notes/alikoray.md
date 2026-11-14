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

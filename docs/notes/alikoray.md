# Notes for Ali Koray

Owner of this file: Ali Koray (`pipeline/`, `planner/`). Delete each note in the PR that handles it.

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

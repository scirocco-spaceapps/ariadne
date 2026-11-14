# Notes for Ali Koray

Owner of this file: Ali Koray (`pipeline/`, `planner/`). Delete each note in the PR that handles it.

## 2026-11-14 — from Bunyamin (task B3): outputs ready for A6

- **What:** `notebooks/out/seen_not_touched_2m.png` (1250 x 1000, RGBA, north-up, two values: alpha 0
  or one orange) and `notebooks/out/targets.geojson` (4 targets, top-level `provenance: "Derived"`
  and `source`, Point in AOI metres, properties `id, area_m2, distance_m, sol`; validates as
  `TargetCollection` with `contracts/check.py`'s validator). Made from bundle 20261114T1101Z.
- **Also:** please add the DATA_SOURCES rows when you publish them (Derived; source in the
  GeoJSON). `fig_seen_not_touched.png` is for Furkan's page, not an asset.

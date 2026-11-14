# Note for Yusuf (contracts/) — from Ali Koray, task A5

1. **SYNTHETIC `cost_2m.f32` in the fixtures.** The planner routes on `cost_2m.f32` (minutes per
   metre, NaN = impassable, 2 m, same grid as `cost_to_home_2m.f32`). The file is outside the contract
   (PLAN_CHANGES A3), so `contracts/fixtures/assets/` does not have it. As a result, Nuri's compose file
   (default `ASSETS_DIR=../contracts/fixtures`) starts the planner, but `/route` and `/abort` answer
   422 "planner data not loaded". Could `contracts/tools/make_fixtures.py` also write a SYNTHETIC
   `cost_2m.f32`? A uniform 1/50 min·m⁻¹ with NaN where the fixture slope ≥ 25° would match the
   existing fixture `cost_to_home` (straight line / 50) closely enough.

2. **The planner reads `aoi.json` from `DATA_DIR/aoi.json`** (override: `AOI_PATH`). With the
   fixtures mounted that is `contracts/fixtures/aoi.json`. On the server, A2 publishes a copy of
   `contracts/aoi.json` next to `bright-angel/`. No contract change is needed. This only records
   where the file is expected.

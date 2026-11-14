# Notes for Yusuf

Owner of this file: Yusuf (`contracts/`, `web/src/map/`).
Delete each note in the PR that handles it.

## 2026-11-14 — from Ali Koray (task A5): SYNTHETIC `cost_2m.f32` in the fixtures

- **What:** have `contracts/tools/make_fixtures.py` also write a SYNTHETIC
  `contracts/fixtures/assets/cost_2m.f32` (minutes per metre, NaN = impassable, 2 m grid, same
  shape as `cost_to_home_2m.f32`). A uniform 1/50 min·m⁻¹ with NaN where the fixture slope is ≥ 25°
  would match the fixture `cost_to_home` (straight line / 50).
- **Why:** the planner routes on `cost_2m.f32`, which is outside the contract (PLAN_CHANGES A3), so
  the fixtures don't have it. With Nuri's compose default (`ASSETS_DIR=../contracts/fixtures`) the
  planner starts, but `/route` and `/abort` answer 422 "planner data not loaded".
- **FYI, no change needed:** the planner reads `aoi.json` from `DATA_DIR/aoi.json` (override
  `AOI_PATH`). With the fixtures mounted that is `contracts/fixtures/aoi.json`. On the server, A2
  publishes a copy of `contracts/aoi.json` next to `bright-angel/`.

## 2026-11-14 — from Bunyamin (task B4, MEDA): DATA_SOURCES row

- **What:** append to `docs/DATA_SOURCES.md` (outside B4's allowed paths):

```
| `content/conditions/meda.json`: sol 1215 air temperature min 192.0 K / max 259.6 K (median of the three mast ATS sensors), pressure 744.7 Pa (daily mean), dust opacity null | Mars 2020 MEDA, NASA PDS Atmospheres Node, CAL_ATS and DER_PS for sol 1215 (doi:10.17189/1522849); notebooks/meda_sol.py | Derived |
```
- **Why:** every value shown in the conditions panel needs a row. PR: B4 MEDA.

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

## 2026-11-14 — from Bunyamin (task B1): `aoi.json` model block and DATA_SOURCES rows

- **What:** in `contracts/aoi.json` set `model.budget_min` 240 -> 360 and `model.reserve_min`
  30 -> 60 (`dwell_min` 20 unchanged). Ali Koray's A4 also proposes this block; whichever PR
  comes first. The `SessionCreate` example in `contracts/check.py` (240/30) is only a schema
  example and can stay.
- **Why:** `model/params.json` is the source of truth (B1). Budget is the planned EVA duration
  (Artemis III nominal 6 ± 2 h; Mars PLSS 6 h case), below the 8 h suit requirement. Reserve is
  the 1 h contingency (Mars PLSS study; xEVA). Until this lands, `python contracts/check.py` fails
  on both keys.
- **Also:** append these rows to `docs/DATA_SOURCES.md` (outside B1's allowed paths):

```
| `model/params.json` max_slope_deg 20, walk_speed_flat_m_per_min 33.3, budget_min 360 (planned EVA duration), reserve_min 60 | Lunar xEVA requirements, Artemis III SDT and Mars PLSS study (NTRS 20210026296, 20260005204); see docs/model.md | Assumed |
| `model/params.json` caution_slope_deg 15 | Team choice, no source | Assumed |
| `model/params.json` dwell_min 20 | Median of nine Apollo 15 geology station times, Apollo 15 Activities Timeline (WUSTL) | Derived |
| `model/params.json` speed_vs_slope | Tobler 1993 hiking function, normalised | Modeled |
| `model/params.json` radiation_dose_rate 210 uGy/day | Hassler et al. 2014, MSL RAD at Gale | Modeled |
| `model/params.json` observer_height_m 2.0 | Bell et al. 2021, Mastcam-Z | Observed |
```

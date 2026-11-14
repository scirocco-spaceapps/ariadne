# Notes for Bunyamin

Owner of this file: Bunyamin (`model/`, `notebooks/`, `docs/model.md`, `docs/validation.md`).
Delete each note in the PR that handles it.

## 2026-11-14 — from Ali Koray (A3/A4 re-run with B1): 3.1 % of the rover track is no-go

- **What:** with `max_slope_deg` = 20, 3.1 % of Perseverance's actual track inside the AOI falls in our
  no-go class (26.3 % is caution, ≥ 15°). Those track cells are therefore unreachable in `cost_to_home`.
- **Why it matters (B4):** part of this comes from the 2 m aggregation, which takes the maximum of four
  1 m Horn slopes. Taking the mean instead lowers track slopes by about 1° (median 11.5° → 10.7°,
  p95 19.2° → 18.2°). Part may be DTM noise; the western AOI also has striping (see `docs/DATA_SOURCES.md`).
  The rover is not a human, but a route the rover drove being "no-go" is worth one sentence in
  validation, or a threshold or aggregation decision.
- **Your call:** keep 20° and max (conservative), or change either. Tell me and I re-run `04_cost.py` →
  `05_cost_to_home.py` (2 minutes).

# Notes for Bunyamin

Owner of this file: Bunyamin (`model/`, `notebooks/`, `docs/model.md`, `docs/validation.md`).
Delete each note in the PR that handles it.

## 2026-11-14 — from Ali Koray (A6): B3 outputs published

- `seen_not_touched_2m.png` and `targets.geojson` passed the checks (1250 x 1000 RGBA, two values;
  TargetCollection; all inside the AOI) and are in the assets and the new bundle. DATA_SOURCES row added
  (Derived, your source string). All four targets are reachable from the haven: 22.0-45.8 min.
- Furkan's target cards must use your ids (`target-cheyava-falls`, `target-masonic-temple`,
  `target-mount-washburn`, `target-closest-pass`); none exist in `content/stops/` yet.

## 2026-11-14 — from Yusuf: MPC replanning, the rule for the console suggestion

The team took MPC in as a **console suggestion** (DECISIONS.md, today): you write the rule in a
notebook, Yusuf ports it to `web/src/map/`. No contract, planner or mission-control change. Time box:
about 2 h; if it is not merged by Sun 09:30 it is dropped.

**Fact to start from.** The real plan is 219.7 min (walk 119.7 + dwell 100); usable time is
`budget_min - reserve_min` = 360 - 60 = 300 min. A walk that goes to plan keeps 80 min spare, so the
rule never fires unless something shrinks the time. Please decide which **trigger** we use:

1. **What-if slowdown** (easiest to demo): the console sets a walking-speed factor (e.g. 0.6 for a
   suit problem) or a dwell overrun; remaining walk times scale with it.
2. **Storm forecast before the alert**: a deadline `t + minutes_to_storm` replaces `B - R` while a
   forecast is known. Note: today a `storm_alert` makes mission-control abort at once (M3), so this
   only works as an earlier "forecast" stage, not on the alert itself.

**Candidate rule** (please confirm or change each line):
- Re-evaluate every `replan_interval_min` simulated minutes (proposal 5) and on arrival at each stop.
- Remaining time `D(t)` = remaining walk legs / speed factor + remaining dwells + the leg home.
- If `t + D(t) <= deadline` (deadline = `B - R`, or the storm deadline): no suggestion.
- Otherwise try, in this order, and suggest the first plan that fits:
  a. shorten the remaining dwells, not below `min_dwell_min` (proposal: half of `dwell_min`);
  b. drop one remaining stop (try each; keep the order of the others);
  c. drop two; and so on; finally "go home now".
- Among plans that fit, keep the most stops; ties go to the larger margin. Never reorder stops.
- Legs for a shortened stop list come from the live planner: `POST /route` with
  `stops = [current stop, ...remaining kept stops]`, `return_home: true`, then ignore the first leg
  (haven → current stop). Between stops, use the current position's stop as the start.

**What we need from you** (all in your directories):
- `notebooks/mpc.ipynb`: the rule on the real `route.json` / `cost_to_home_2m.f32`, one scenario per
  trigger, and one figure for the project page (`notebooks/out/`).
- New parameters in `model/params.json` with provenance (e.g. `replan_interval_min`,
  `min_dwell_min`); `Assumed` is fine where there is no source.
- A short "Replanning" section in `docs/model.md` with the final rule in words, so the web code
  follows the same text. Tell Yusuf (note in `docs/notes/yusuf.md`) when it is merged.

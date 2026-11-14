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

The team took replanning in as a **console suggestion** (DECISIONS.md, today): you write the rule
in a notebook, Yusuf ports it to `web/src/map/`. No contract, planner or mission-control change.
Time box: 2 h. If the web version is not merged by Sun 09:30 it is dropped. Task line: MPC-1 in
`docs/TASKS.md` (tick it in your PR).

**Fact to start from.** The real plan is 219.7 min (walk 119.7 + dwell 100); usable time is
`budget_min - reserve_min` = 360 - 60 = 300 min, so a walk that goes to plan keeps 80 min spare and
the rule never fires on its own. The two **triggers** (your choice, both what-if controls on the
console):

1. **Suit leak:** the consumables budget drops (by an amount or to a value); the deadline shrinks.
2. **Dust / visibility:** a speed factor on the walking cost (wind is modelled as dust and
   visibility, not as a force on the astronaut); remaining walk times grow.

**Candidate rule** (confirm or change each line, one sentence of reasoning per line):
- Re-evaluate every `replan_interval_min` simulated minutes (proposal 5), on arrival at each stop,
  and when a trigger changes.
- Remaining time `D(t)` = remaining walk legs / speed factor + remaining dwells + the leg home.
- If `t + D(t) <= budget - reserve` (with the budget after a leak): no suggestion.
- Otherwise try, in this order, and suggest the first plan that fits:
  a. shorten the remaining dwells, not below `min_dwell_min` (proposal: half of `dwell_min`);
  b. drop one remaining stop (try each; keep the order of the others);
  c. drop two; and so on; finally "go home now".
- Among plans that fit, keep the most stops; ties go to the larger margin. Never reorder stops.

**Data.** The real route is not a file: get it from the live planner, `POST /route` with the stops
of `contracts/aoi.json` in order and `return_home: true` (planner URL in DECISIONS.md, laptop
hosting line), and save the response to `notebooks/out/route.json` with the fetch time. For a
shortened stop list call `POST /route` with `stops = [current stop, ...remaining kept stops]` and
ignore the first leg (haven → current stop), since `/route` always starts at the safe haven.
`cost_to_home_2m.f32` comes from the asset host (`assets_base` in `contracts/aoi.json`). If the
planner does not answer or the raster's shape does not match `contracts/aoi.json`, stop and report;
do not invent values.

**Deliverables** (all in your directories):
- `notebooks/replanning.ipynb`: one scenario per trigger; one figure in `notebooks/out/` showing
  the margin to home before and after each event and the decision.
- `notebooks/out/replanning_cases.json`: per scenario the inputs (`t_min`, current stop, trigger and
  value) and the expected decision (kept stops, shortened dwells, margin in min). MPC-2's tests
  and MPC-3's check use this file.
- New parameters in `model/params.json` with provenance (`Assumed` where there is no source).
- A short "Replanning" section in `docs/model.md` with the final rule in words; call it
  receding-horizon replanning, not MPC.
- Then delete this note and add one to `docs/notes/yusuf.md` that the rule is merged, saying: do not
  merge the web version before MUST 6 is confirmed (e2e demo90 green and the storm scenario ran
  once on the live app).

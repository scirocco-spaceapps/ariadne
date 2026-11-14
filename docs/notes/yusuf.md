# Notes for Yusuf

Owner of this file: Yusuf (`contracts/`, `web/src/map/`).
Delete each note in the PR that handles it.

## 2026-11-14 — from Nuri (task N4): a way for the cuff to read a session's route (contracts)

- **What:** a `GET /sessions/{id}` in `contracts/openapi.yaml` that returns what `POST /sessions`
  received (at least `route`, `budget_min`, `reserve_min`, `dwell_min`). Mazlum would serve it in
  mission-control (note in `docs/notes/mazlum.md`).
- **Why:** the cuff is another device and only gets `state` frames, so it cannot know the planned
  route (next stop, distance, ETA). N4 works around it: the pairing QR carries the stop order
  (`/cuff?s=<id>&stops=a,b,c&home=1`) and the cuff asks the planner for the same route. That breaks
  if the planner data changes between the console's plan and the cuff's.
- **Priority:** LATER; the workaround is fine for the demo.

## 2026-11-14 — from Bunyamin (MPC-1): the replanning rule is ready for MPC-2

- **What:** the rule is in `notebooks/replanning.py` (`decide`, no dependencies, port it line by
  line) and in words in `docs/model.md`, "Replanning". `notebooks/out/replanning_cases.json` has 9
  cases (inputs and expected decisions) plus `walk_min` / `home_min` from the live planner and the
  console presets (`speed_factor` 0.5 / 0.4, `leak_min` 90 / 120 / 150). Your tests should get the
  same `expected` for each `input`.
- **Inputs on the console:** `home_now_min` is `cost_to_home` at the astronaut's position (the
  envelope already has it); stop-to-stop times come from `POST /route` as in your brief. The stop
  being walked to is never dropped mid-leg.
- **Show:** the suggestion text plus "reserve at home" (`reserve_at_home_min`); when `margin_min`
  is negative ("go home now" case), say the reserve is in use.
- **Gate:** do not merge the web version before MUST 6 is confirmed (e2e demo90 green and the storm
  scenario ran once on the live app).

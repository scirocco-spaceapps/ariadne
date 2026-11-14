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

- **What:** the rule is `decide()` in `notebooks/replanning.py` (plain Python, port it line by line)
  and in words in `docs/model.md`, "Replanning" (definitions of `D`, `margin`, `reserve_left`, the
  9 rule lines with reasons).
- **Test source:** MPC-2 tests run against `notebooks/out/route.json` (leg table `legs_min`, planner
  commit) and `notebooks/out/replanning_cases.json` (11 cases, each with its own params, input
  including x/y in metres, and expected decision), **not the live planner**. Matching rule in the
  file: `action`, `reason`, `kept`, `dropped`, `dwell_min` exact; `margin_min`, `reserve_left_min`,
  `end_min` within 0.5 min.
- **Console controls:** defaults and ranges are in the cases file under `console` (Simulation):
  `speed_factor` default 0.5, 0.3–1.0, step 0.1; `leak_min` default 120, 0–180, step 10.
- **On the console:** `home_now_min` is `cost_to_home` at the astronaut's (x, y); `lead_min` = leg
  time × remaining path length / leg path length; while a storm alert is active, show no suggestion.

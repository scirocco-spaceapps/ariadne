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

## 2026-11-14 — from Bunyamin (MPC-3): live suggestion matches the notebook; one difference after a seek

- **Checked on the live site** (Vercel build of 17:50Z, server planner and mission-control, session
  `ace091533599334e`, 2026-11-14 ~18:30Z; headless Chromium, clock seeks and start/pause through
  `/sessions/{id}/control`, controls set in the replanning panel). Both triggers match
  `notebooks/out/replanning_cases.json`, on the walk in, at arrival and through the dwell:
  - dust ×0.5, arrival at Mount Washburn (t 23–31): "Shorten every remaining stop to 16 min. Home
    with 63 min reserve" (notebook: 16 min, reserve 63.34). Walking in at t 20: 16 min, 61 min
    (notebook with the walk left: 60.7).
  - suit leak 120, arrival at Bright Angel (t 89–95): "Skip Masonic Temple. Home with 61 min
    reserve" (notebook: drop Masonic Temple, 20 min, 61.02); same while walking in from t 85.
  - storm alert at Bright Angel: "Storm alert: following the way home, no replan."; after Clear the
    suggestion comes back.
- **Difference:** the arrival time is the first state the console sees at the stop, so a seek into
  a dwell (or a page reload during one) counts the dwell spent so far as 0. Seek to t 30 at Mount
  Washburn: live 15 min, rule 16 min. Seek to t 100 at Bright Angel: live "Skip Masonic Temple,
  stops 14 min", rule 20 min; seeking back to t 90 at the same stop keeps the arrival at 100 and
  shows 19 min. `decide()` with `dwell_done_min` 0 gives exactly the live answers, so the port is
  right and only the input differs. It errs on the safe side (shorter dwells, never a later return).
- **Suggestion (your call):** when the console did not see the arrival, take it from the route's
  timeline (the `dwell` item's `t0_min` for that stop), or use `min(seen, planned)`; check that a
  storm abort and Clear still behave. If not fixed: do not seek into a dwell during the demo.
- **Priority:** low; nothing is wrong on a normal run.

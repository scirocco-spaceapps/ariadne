# Notes for Yusuf

Owner of this file: Yusuf (`contracts/`, `web/src/map/`).
Delete each note in the PR that handles it.

## 2026-11-14 — from Bunyamin (task B4, MEDA): DATA_SOURCES row

- **What:** append to `docs/DATA_SOURCES.md` (outside B4's allowed paths):

```
| `content/conditions/meda.json`: sol 1215 air temperature min 192.0 K / max 259.6 K (median of the three mast ATS sensors), pressure 744.7 Pa (daily mean), dust opacity null | Mars 2020 MEDA, NASA PDS Atmospheres Node, CAL_ATS and DER_PS for sol 1215 (doi:10.17189/1522849); notebooks/meda_sol.py | Derived |
```
- **Why:** every value shown in the conditions panel needs a row. PR: B4 MEDA.

## 2026-11-14 — from Nuri (task N4): a way for the cuff to read a session's route (contracts)

- **What:** a `GET /sessions/{id}` in `contracts/openapi.yaml` that returns what `POST /sessions`
  received (at least `route`, `budget_min`, `reserve_min`, `dwell_min`). Mazlum would serve it in
  mission-control (note in `docs/notes/mazlum.md`).
- **Why:** the cuff is another device and only gets `state` frames, so it cannot know the planned
  route (next stop, distance, ETA). N4 works around it: the pairing QR carries the stop order
  (`/cuff?s=<id>&stops=a,b,c&home=1`) and the cuff asks the planner for the same route. That breaks
  if the planner data changes between the console's plan and the cuff's.
- **Priority:** LATER; the workaround is fine for the demo.

# Open tasks after the plan changes

Tasks added or moved after the task book (Görev Kitabı). Cards not listed here follow the task book.

**How to use:** when your PR for a task merges, change its `[ ]` to `[x]` in that same PR and add the
PR number. Only tick your own lines; do not reword or delete other lines (append new tasks at the
end of their section). Mazlum has no tasks here: Yusuf took over his remaining card (M7).

## MPC replanning, as a console suggestion

Decision: `docs/DECISIONS.md` (2026-11-14, MPC). Rule brief: `docs/notes/bunyamin.md`. Dropped if
MPC-2 is not merged by **Sun 09:30**; the Sun 11:00 feature freeze holds.

- [x] **MPC-1 · Bünyamin · Sat now → ~21:00 (2 h box)** (#64) — the rule in a notebook.
  Work only inside `notebooks/`, `model/params.json`, `docs/model.md` (plus notes and this line).
  Triggers: suit leak (budget drops) and dust/visibility (speed factor). Real route from the live
  planner, saved to `notebooks/out/route.json`. Deliver `notebooks/replanning.ipynb`, a figure in
  `notebooks/out/`, `notebooks/out/replanning_cases.json` (inputs and expected decisions), new
  parameters with provenance in `model/params.json`, and a "Replanning" section in
  `docs/model.md`. Done when merged and a note in `docs/notes/yusuf.md` says so.
- [x] **MUST 6 check · Yusuf · while MPC-1 runs** — gate for merging MPC-2. (#63)
  The e2e demo90 test is green on main, and the storm scenario runs once on the live app
  (alert, thread home on the console, alert screen on the cuff, clear).
- [x] **MPC-2 · Yusuf · after MPC-1 and the MUST 6 check, before Sat 23:30** — the rule on the console.
  Work only inside `web/src/map/`. A suggestion overlay on the map ("skip X, home with N min
  reserve") and the two what-if controls (suit leak, dust/visibility); replans call the existing
  `POST /route` with `[current stop, …remaining]`. Hidden in DEMO mode (no planner). Done when the
  tests reproduce `notebooks/out/replanning_cases.json` and the PR is merged.
- [ ] **MPC-3 · Bünyamin · Sun 08:00–08:30** — check the web suggestion against the notebook.
  Run both scenarios on the live app; write any difference to `docs/notes/yusuf.md`. Add a
  paragraph on replanning to `docs/submission/science.md` as part of B5.

## Mazlum's card, taken over by Yusuf

- [ ] **M7 · Yusuf · Sun 10:00–15:00** — integration support for mission-control.
  Bug fixes only, no new endpoints. Services run on Nuri's laptop: Yusuf fixes the code, Nuri
  restarts the service. Before the demo, restart it and keep one session open. Done when the
  service ran through the rehearsals and the judging.

## Yusuf's remaining cards (unchanged, listed for one view)

- [ ] **23:30 checkpoint · Yusuf · Sat 23:30** — drive the 90 s scenario end to end on both screens
  (Y6 card).
- [ ] **Y8 · Yusuf · Sun 10:00–11:00** — two runs on the live URL, README from what exists, secret
  scan of the git history, then make the repo public.

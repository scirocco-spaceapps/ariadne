# Notes for Nuri

Owner of this file: Nuri (`web/` except `src/map` and `src/stops`, `infra/`, `.github/`).
Delete each note in the PR that handles it. Also read `docs/PLAN_CHANGES.md` (your section).

## 2026-11-14 — from Yusuf: contract details for your cards

- **DEMO mode (N1):** replay `contracts/fixtures/ws-state.jsonl`: 60 `state` messages one simulated
  minute apart plus `event` lines; storm alert at t = 30, home at t = 38, clear at t = 50. The
  file has no wall-clock timing, so pick any replay rate (the live service sends 2 states per
  second). Fixture files sit in `contracts/fixtures/` and `contracts/fixtures/assets/`.
- **N2:** ports planner 8000, mission-control 8080. Assets: `DATA_DIR=/srv/assets`; the AOI's files
  are under `/srv/assets/bright-angel/` (`assets_base`), so `VITE_ASSETS_URL` is the assets host
  root, e.g. `https://assets.<domain>/`.
- **N4:** while `alert` is set, the next stop is the safe haven and `leg` is `null`. `visited` only
  lists stops whose full dwell finished. Time to storm =
  `alert.lead_min - (t_min - alert.since_t)`.
- **N5:** every condition part has `mode` (`archive` or `live`) for the archive/live label, plus
  `provenance`, `source`, optional `source_url`, `fetched_at`. A null part has its reason in
  `missing.<part>`. Weather is `{sol, values, units}`; radiation `{value, unit, measured_at}`;
  partner `{agency, mission, value, unit, source_url}` (hide the slot when `partner` is null). The
  route response has no elevation profile: sample `dem_4m.f32` along the leg paths for the small
  elevation line (`web/src/map/coords.ts` has `worldToRaster` and `cellIndex` for that). The
  planner answers 422 with `{detail}` for an unknown or unreachable stop; show it in the route
  sheet's error state.

## Coming from Yusuf

- **Y5** will export `marginAt(x, y, t)` and the colour thresholds from `web/src/map/envelope.ts`
  for the cuff (N4). A note will follow here when it lands.

## 2026-11-14 — from Furkan: StopCard is ready (F2)

Handled: the `/dev/stops` route is in `web/src/app/App.tsx`; photo hosting and task ticks are
answered in `docs/notes/furkan.md`. Still open for N4 and N6:

- **Mounting:** `<StopCard variant="cuff" id={state.at_stop} />` on the cuff and
  `<StopCard variant="console" />` in the console's Stop tab. Without `id` it shows the store's
  `selectedTarget ?? selectedStop`. The cuff variant has no own background or padding: put it
  inside the black cuff layout.

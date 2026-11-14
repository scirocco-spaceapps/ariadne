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

## 2026-11-14 — from Ali Koray: real assets bundle for the laptop host (answers your note)

- **What:** `ariadne-assets-20261114T1048Z.zip` (27 MB). Koray sends you a share link. Inside: `aoi.json`
  plus `bright-angel/` (every raster with its sidecar, both GeoJSON files, `cost_2m.f32` for routing,
  `cost_to_home_2m.f32` from the real safe haven, `cost_to_home_flat_2m.f32`) and a `BUNDLE.txt` listing
  sources and sizes.
- **How:**
  1. Unzip into one folder, e.g. `~/ariadne-assets/` (it then holds `aoi.json` and `bright-angel/`).
  2. Set `ASSETS_DIR=~/ariadne-assets` in `infra/.env.laptop`.
  3. `git pull` the repo, so mission-control mounts the B1 `model/params.json` (your copy was pre-B1,
     which is why `/conditions` radiation says "B1 not yet").
  4. Restart the stack. Check: `POST /planner/route` with
     `{"stops":["mount-washburn","tuff-cliff","bright-angel","cheyava-falls","masonic-temple"],"return_home":true}`
     returns 6 legs and `eva_min` 224.03.
- **Note on stops:** the bundle's `aoi.json` already has the real haven and stops from PR #32 (Yusuf
  reviewing). The web app bundles `contracts/aoi.json` at build time, so the map shows the real stop
  markers only after #32 merges and Vercel is rebuilt. Until then the map shows the placeholder stops
  while the planner routes the real ones.
- **Re-sends:** I rebuild with `pipeline/scripts/07_bundle.sh` whenever the assets change (e.g. if
  Bunyamin changes the 20° threshold).

## 2026-11-14 — from Ali Koray: newer bundle, use this one

- `ariadne-assets-20261114T1101Z.zip` (28 MB) replaces `…T1048Z`. Slope is now the 2 m mean (Bunyamin's
  decision), so the slope, traversability and cost rasters changed; `aoi.json` is now straight from
  `contracts/aoi.json` (real stops, since #32 merged).
- Same steps as above. The check request now returns `eva_min` 219.65.

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

## 2026-11-14 — from Yusuf (task Y4): route, stops and time bar on the map

- **What landed in `web/src/map/`:** the map now reads `route`, `session.state`, `selectedStop` and
  `selectStop` from `useMission` (no store change). Planned route dashed ahead / solid walked,
  numbered stop markers, the astronaut at `state.pos` (labelled Simulation), clicking a stop calls
  `selectStop(id)`, and a time bar at the bottom of the map.
- **Plan time lives in the map for now:** planning mode (a route, no session) is driven by
  `usePlanClock` (`t_min`, `setT`), exported from `web/src/map`, because `useMission` has no
  planning-time field. If you want it in the mission store (e.g. `planT_min`, so the route sheet can
  highlight the current leg), say so and I switch the map to read it; nothing else depends on it.
- **Reusable for N4/N6:** `routeGeometry`, `progressAtTime`, `progressFromState`, `nextProgress`,
  `pointAt`, `stopNumbers`, `arrivalTicks` from `web/src/map`.
- **No action needed** unless you want the store field above.

## 2026-11-14 — from Yusuf (task Y5): `marginAt` for the cuff (N4)

- **What:** the return envelope is on the map, and the pieces for the cuff are exported from
  `web/src/map`:
  - `useCostToHome(source)` → `CostRaster | null` (fetches `rasters.cost_to_home` once per URL;
    null while loading or if the file is missing). Use the same `source` as the console
    (`fixtureSource()` in DEMO, `remoteSource(aoi, assetsUrl)` live).
  - `makeMarginAt(cost, aoi.model)` → `(x, y, t) => minutes | null`; or `marginAt(cost, model, x, y, t)`.
    margin = `(budget_min - t) - reserve_min - cost_to_home`; null outside the AOI or where the way
    home is blocked (NaN).
  - `marginClass(margin, aoi.model)` → `'safe' | 'tight' | 'out'` (safe ≥ reserve, tight 0…reserve,
    out < 0 or null) and `ENVELOPE_COLORS` for the same three classes, so cuff and map agree.
- **Example:** `const m = makeMarginAt(cost, aoi.model)(state.pos[0], state.pos[1], state.t_min)`.
  Provenance on screen: `Modeled` (`Simulation` on fixtures).
- This closes the "Coming from Yusuf" line about Y5 above (you delete it when you like).

## 2026-11-14 — from Ali Koray: bundle with the B3 layer (ariadne-assets-20261114T1159Z.zip)

- Replaces `…T1101Z` (which is what the live host should run now; it still answers `eva_min` 224.03, i.e. the
  older `…T1048Z`). Adds `seen_not_touched_2m.png` and `targets.geojson` (B3, for Y7). Same steps as above;
  check: `/planner/route` returns `eva_min` 219.65 and `/bright-angel/targets.geojson` loads.

## 2026-11-14 — from Yusuf (task Y6): storm helpers for the cuff

- **What landed on the map:** during a storm alert the map draws `abort_path` as the red thread,
  the envelope shows only where home is reachable before the storm (amber, rest dimmed), the safe
  haven pulses, the planned route fades and the time bar shows "Storm in N min". On `clear` it all
  goes back. Tried end to end with your Storm alert / Clear buttons on a local mission-control.
- **For the cuff (exported from `web/src/map`):** `minutesToStorm(lead_min, since_t, t_min)` and
  `timeToStorm(alert, t_min)` (the contract formula, floored at 0), `envelopeMode(state)`
  (`{kind: 'normal'}` or `{kind: 'storm', minutes_left}`), and `stormMarginAt(cost, x, y, minutes_left)`
  = minutes to spare walking home before the storm, null if blocked.
- **No action needed** unless you want the cuff to show the storm margin.

## 2026-11-14 — from Furkan (task F4): LATER, astronaut position as text on the console

- **What:** a `data-testid` element on the console with the astronaut's `state.pos` (e.g. the
  map's astronaut tooltip or a small readout), like the cuff's `cuff-pos`.
- **Why:** the console draws the astronaut only on the WebGL map, so the demo90 e2e test reads
  the console's position from its store through the Vite dev server. A readout would let the test
  check the screen instead and also run against a built site. LATER, not needed for the demo.

## 2026-11-14 — from Yusuf: MPC replan suggestion on the console (FYI)

The team took MPC in as a console suggestion (DECISIONS.md). Yusuf builds it inside `web/src/map/`:
a small overlay on the map that says, for example, "Plan no longer fits: skip Cheyava Falls, home
with 62 min reserve", plus, if Bunyamin picks that trigger, a what-if walking-speed control. It
calls the planner's `POST /route` through the existing `plannerUrl`, and does not change the session
or the cuff. Nothing needed from you now; if you want the control in the session bar instead of the
map overlay for N6, say so in `docs/notes/yusuf.md`.

## 2026-11-14 — from Yusuf: services moved to the Hetzner server

- **What:** planner, mission-control and the assets now run on the Hetzner server (DECISIONS.md,
  last entry), tested from outside: `/health` on both, assets with CORS for the Vercel origin,
  `/route` `eva_min` 219.65, a session and a `wss` connection. The deploy workflow ran green.
- **Needed from you:** switch the three Vercel production values and rebuild (`vercel --prod`, or
  the web-deploy workflow from #70 once `VERCEL_TOKEN` is set):
  `VITE_PLANNER_URL=https://api.2-31-2-199.sslip.io`, `VITE_MC_URL=https://mc.2-31-2-199.sslip.io`,
  `VITE_ASSETS_URL=https://assets.2-31-2-199.sslip.io/`. Then a phone test on mobile data.
- **Your laptop:** keep `infra/funnel.sh` as the fallback; the laptop may sleep now. SSH to the
  server: `ssh deploy@2.31.2.199` (your key is on it). Update `infra/CLAUDE.md` ("Laptop hosting
  until the real server") when you like.

## 2026-11-14 — from Yusuf: first web-deploy run failed (Hobby plan, commit author)

- **What:** after `VERCEL_TOKEN` was set and #70 merged, run 43624539823 failed at "Deploy to
  production": "Can't build deployment … The commit author doesn't have access to this team." The
  merge commit is Yusuf's, and the CLI sends the git commit metadata from the checkout, so the
  Hobby rule still applies to prebuilt CLI deploys. Build and checks passed; the live site kept
  your manual deploy (already on the sslip.io hosts).
- **Suggested fix (untested):** in `.github/workflows/web-deploy.yml`, first line of the
  "Deploy to production" step: `rm -rf ../.git` (the job runs in `web/`). Without `.git` the CLI
  sends no commit author and the deploy counts as the token owner's. Then Actions → web-deploy →
  Run workflow. If that still fails, keep deploying by hand (`vercel --prod`) until after judging.

## 2026-11-15 — from Yusuf: N7 merged (#80) and checked on the live server

Merged after a local re-check on top of the latest main (lint, 297 tests, build, e2e demo90 all
green). Then on the live site (Vercel + Hetzner), console at 1920 x 1080 and cuff in iPhone 13
emulation, Playwright recording both, session running at 1 min/s:

- `docker compose stop mission-control` at 00:08:58: both screens showed "Lost mission-control ·
  DEMO DATA in 10 s" within about 2 s and switched to DEMO DATA at 00:09:10.
- `docker compose start mission-control` at 00:09:12: the console recreated the session at
  T+0:06 (new id) within 3 s, said "pair the cuff again" and kept running; the cuff said
  "Session ended on mission-control · scan the new QR on the console", as designed.
- Recordings and stills (outside the repo, on Yusuf's PC): `Desktop\NASA\yedek-kayit-2026-11-15\`
  (backup run of the whole scenario with the alert mid-walk, and `kopma-testi\` for this test).

Still yours: a real phone over mobile data (wake lock, QR scan with the camera).

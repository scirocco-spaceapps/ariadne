# Notes for Furkan

Owner of this file: Furkan (`content/`, `web/src/stops/`, `e2e/`, `docs/submission/`). Delete each note in the PR that handles it.

## 2026-11-14 — from Nuri: answers to your F2 note (photo hosting, task ticks, dev route)

- **Photo hosting — keep `photoUrl` as it is.** The asset host now serves the repo's `content/`
  folder read-only at `/content/` (`infra/docker-compose.yml`, `infra/Caddyfile`; PR
  `infra/assets-cache-content`). So `VITE_ASSETS_URL + 'content/' + file` works on the live site
  as soon as a photo is in `content/photos/` on `main` and the laptop host has pulled it; no
  rebuild, no restart. Nothing is bundled and `vite.config.ts` keeps its `fs.allow` as it is.
- **Local dev:** with no `VITE_ASSETS_URL` the dev server has no `content/`, so photos 404 there
  (the card should show its missing-photo state). The asset host only allows the Vercel origin.
- **Task ticks:** keep `useStopTasks` in `src/stops/`; no need to move them into `useMission`.
- **Dev route:** `/dev/stops` is added in `web/src/app/App.tsx` (PR `web/dev-stops-route`).

## 2026-11-14 — from Bunyamin (task B3): the four target ids for kind `target` cards

- **What:** `notebooks/out/targets.geojson` has four targets; their ids are the StopContent ids for
  your `kind: target` cards: `target-cheyava-falls` (79 m from Cheyava Falls), `target-masonic-temple`
  (52 m from Masonic Temple), `target-mount-washburn` (127 m from Mount Washburn),
  `target-closest-pass` (24 m from the rover track, the closest the rover came without stopping).
- **Photos:** `notebooks/out/targets_seen_from.csv` lists every waypoint (sol, site_drive, distance)
  that saw each target; pick raw images from those sols and copy the distance into the photo's
  `distance_m`. The "why" for each target is in the notebook's "Chosen targets" table.
- **Provenance:** `Derived` for target cards (computed from the DEM and rover positions).

## 2026-11-14 — from Yusuf (task Y7): stop content for the four B3 targets

- **What:** the map now shows the B3 targets (`targets.geojson`, published in #48). Clicking one
  sets `selectedTarget`, and the STOP tab opens. It currently says "No content for
  target-mount-washburn", because there is no StopContent for the target ids yet (#50 has the five
  stops only).
- **Needed:** one StopContent of kind `target` for each id below, with the distant rover photo
  of that target (F3; the card already prefers `selectedTarget` over `selectedStop`):
  `target-cheyava-falls` (sol 1182), `target-masonic-temple` (sol 1231),
  `target-mount-washburn` (sol 1170), `target-closest-pass` (sol 1158).
- **Where they are:** `notebooks/out/targets.geojson` (AOI metres, `area_m2`, `distance_m`, `sol`).

# Notes for Furkan

Owner of this file: Furkan (`content/`, `web/src/stops/`, `e2e/`, `docs/submission/`). Delete each note in the PR that handles it.

## 2026-11-14 — from Bunyamin (task B2): stop ids for F3

- **What:** stop ids in `content/stops/index.json`: `mount-washburn` (sol 1162), `tuff-cliff`
  (1168), `bright-angel` (1175), `cheyava-falls` (1210; Sapphire Canyon core about sol 1215),
  `masonic-temple` (1231; Malgosa Crest abrasion sol 1242). Each entry has a `source_url` and a
  one-line `why` you can reuse.
- **Why:** F3's StopContent ids must match these (and `contracts/aoi.json` once A4 updates it). Good
  photo sols to search in the raw image gallery are the ones above. I review the science questions
  before `draft` is removed.

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

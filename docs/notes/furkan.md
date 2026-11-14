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

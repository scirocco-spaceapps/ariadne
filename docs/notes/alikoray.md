# Notes for Ali Koray

Owner of this file: Ali Koray (`pipeline/`, `planner/`). Delete each note in the PR that handles it.

## 2026-11-14 — from Yusuf: asset bundles now go to the server

- **What:** planner and the assets run on the Hetzner server since Sat ~20:30 (root `CLAUDE.md`,
  Live services). It serves bundle `20261114T1159Z`; `/route` with the five stops answers
  `eva_min` 219.65. Nuri's laptop is only the fallback, so a bundle sent there no longer reaches
  the live site.
- **New bundle:** send the zip to Yusuf or Nuri, or, if your SSH key is added (send Yusuf your
  `.pub` line), run:
  `scp ariadne-assets-<time>.zip deploy@2.31.2.199:/tmp/`, then on the server
  `rm -rf /srv/assets/bright-angel && unzip -o /tmp/ariadne-assets-<time>.zip -d /srv/assets`
  and `cd ~/ariadne && docker compose -f infra/docker-compose.yml --env-file infra/.env restart planner`.
- **Planner code:** a merge into `planner/` redeploys the server by itself. Keep to the merge
  freeze in root `CLAUDE.md` (no merges during runs, rehearsals, the video shoot or judging).
- `pipeline/CLAUDE.md` line 14 ("server uses `/srv/...`") is right; no change needed.

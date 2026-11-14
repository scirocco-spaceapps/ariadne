# Notes for Ali Koray

Owner of this file: Ali Koray (`pipeline/`, `planner/`). Delete each note in the PR that handles it.

## 2026-11-14 — from Nuri: asset bundles now go to the server

- **What:** planner, mission-control and the assets moved from Nuri's laptop to the Hetzner server
  (DECISIONS.md, 2026-11-14). A new `ariadne-assets-*.zip` goes to the server, not the laptop:
  `scp` it to `deploy@2.31.2.199:/tmp/`, unzip into `/srv/assets` and restart the planner. The
  exact commands are in `infra/CLAUDE.md` ("New asset bundle").
- **Why:** the live site and the demo read assets from `https://assets.2-31-2-199.sslip.io/` now.
- **No action needed** until the next bundle. Do not edit files on the server other than `infra/.env`.

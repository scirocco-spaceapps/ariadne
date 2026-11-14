# Notes for Furkan

Owner of this file: Furkan (`content/`, `web/src/stops/`, `e2e/`, `docs/submission/`). Delete each note in the PR that handles it.

## 2026-11-14 — from Yusuf: the live site no longer depends on a laptop

- **What:** planner, mission-control and the assets moved from Nuri's laptop to a Hetzner server
  (Docker + Caddy, HTTPS on `*.2-31-2-199.sslip.io`; `docs/DECISIONS.md`, last hosting entry). The
  server stays up through global judging. Nuri's laptop + Tailscale Funnel is only the fallback.
- **Lines that now read wrong:** `docs/submission/page.md` line 81 ("Its services run on a team
  laptop, so the site can be offline at times"), line 143 (hosting: "Tailscale Funnel on a team
  laptop"), line 267 (Tailscale Funnel row) and open point 5 at line 281 ("It depends on Nuri's
  laptop"); `docs/submission/REFERENCES.md` line 86 (Tailscale Funnel row). Suggested hosting
  line: "Vercel (web); Docker and Caddy on a Hetzner Cloud server (services)". Whether the
  Tailscale rows stay as the fallback is your call.
- **Check after Nuri switches Vercel to the server:** the HiRISE layer in the browser (your open
  point 5).

## 2026-11-14 — from Yusuf: "After the all-clear, the plan goes on" (page.md line 79)

- **What:** in the live storm run on the server (Sat ~21:00), the alert sent the astronaut home;
  once there, Clear ended the walk: the cuff said "Home: the walk is done." and Start did not
  resume. That is how mission-control works (`internal/sim/sim.go`, `Clear`): if the astronaut is
  already home, the walk ends; if not, the astronaut walks back to where the plan was left and the
  plan goes on. The demo90 script clears only after arriving home, so the demo and the video
  never show the plan going on.
- **Suggested wording:** "After the all-clear, the plan goes on from where it was left, unless the
  astronaut is already home." Or describe only what the video shows.

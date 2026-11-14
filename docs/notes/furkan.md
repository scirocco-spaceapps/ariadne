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

## 2026-11-14 — from Bunyamin (B5): science.md is ready to paste

- **What:** `docs/submission/science.md` section 1 ("For page.md", 283 words) is the text for the
  "Science" placeholder in `page.md` (lines 117–120). Sections 2–9 are the full write-up: stops and
  questions, seen-not-touched targets, data products, what the model tells a planner, replanning
  (MPC-3) and limitations. Every number comes from `docs/DATA_SOURCES.md`, `docs/model.md`,
  `docs/validation.md` or `notebooks/out/`.
- **Open points in page.md this closes:** 2 and 7 (science write-up). Point 9: MPC-2 is merged and
  on the live site, and its suggestions match the notebook (live check on 2026-11-14, #76); the
  last paragraph of the paste block covers it in one sentence.
- **Merge:** the PR stays unmerged until you say so, as you asked.

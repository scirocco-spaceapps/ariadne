# Ariadne — rules for every session

Ariadne is a walking-scale Mars EVA map for Bright Angel in Jezero crater. It layers NASA data,
plans a science walk, and shows at every moment whether the astronaut can still get back to the
safe haven. NASA Space Apps 2026.

**Before you start a task card, read `docs/PLAN_CHANGES.md`.** It lists where the repo differs
from the task book (Görev Kitabı), the game plan and the visual brief. When they disagree:
`contracts/` > `docs/PLAN_CHANGES.md` > the task prompt.

## Directory map

| Directory | Owner | What lives there |
|---|---|---|
| `contracts/` | Yusuf | AOI, OpenAPI, WebSocket messages, fixtures. Frozen after `contracts-v1`. |
| `pipeline/` | Ali Koray | Scripts that turn NASA products into the rasters/vectors in `contracts/aoi.json`. |
| `planner/` | Ali Koray | FastAPI service: `/route`, `/abort`. Port 8000. |
| `mission-control/` | Mazlum | Go + Fiber service: conditions, sessions, `/ws`. Port 8080. |
| `web/` | Nuri | Vite + React + deck.gl client. Port 5173. |
| `web/src/map/` | Yusuf | Map layers. |
| `web/src/stops/` | Furkan | Stop cards and content views. |
| `model/` | Bunyamin | Walk/cost model parameters (`params.json`). |
| `notebooks/` | Bunyamin | Exploration and validation notebooks. |
| `content/` | Furkan | Stop texts, photos, captions. `stops/index.json` and `conditions/` are Bunyamin's. |
| `e2e/` | Furkan | End-to-end tests across services. |
| `infra/` | Nuri | Deploy, hosting, scripts. `.github/` is also Nuri's. |
| `docs/` | see `docs/CLAUDE.md` | Shared logs, model/validation notes, submission. |

Exact ownership is in `.github/CODEOWNERS`. Each directory has its own `CLAUDE.md` with run/test commands.

## Rules

### Scope
- Edit only inside the directory you were started for. If another directory must change, stop and
  append a note to `docs/notes/<owner>.md` (what, where, why, which task). Do not make the change
  yourself.
- At the start of every task, read `docs/notes/<your name>.md` if it exists: other owners leave
  requests for you there.
- New dependencies need the directory owner's OK. Do not touch root config, CI or lockfiles outside
  your directory.

### Contracts
- `contracts/` is frozen after tag `contracts-v1`. Changes go through Yusuf as a PR.
- Code against `contracts/fixtures/` until real data lands. Never change a fixture to make your code pass.
- Web types come from the contracts: `cd web && npm run gen:types` regenerates `src/lib/types.ts`.
  Never edit that file by hand.

### Coordinates
- Everywhere: local metric plane, x east, y north, metres from the AOI south-west corner.
- Rasters are north-up, row 0 at the north edge. Pixel centre of (row, col):
  `x = (col + 0.5) * px_m`, `y = size_m[1] - (row + 0.5) * px_m`.
- `.f32` rasters are little-endian float32, row-major, no header; width = `size_m[0] / px_m`.
- Never Web Mercator. Never lon/lat inside services; `crs.proj4` in `aoi.json` is for the pipeline only.
- GeoJSON files (`track`, `waypoints`, `targets`, `geology`) are in AOI metres too, not lon/lat.
- Asset paths: web = `VITE_ASSETS_URL + assets_base + file`; planner/pipeline = `DATA_DIR + assets_base + file`.

### Provenance
- Every value shown to a user carries provenance: `Observed`, `Derived`, `Modeled`, `Assumed` or
  `Simulation`.
- Never invent measurements. A value without a source is `Assumed` and listed in `docs/DATA_SOURCES.md`.
- Synthetic fixtures are labelled SYNTHETIC and never shown as real data.

### Language and commits
- English for code, comments, UI copy and commits.
- Commit prefix is the directory name: `planner: add slope penalty`, `web: cuff layout`, `repo: ...` for root.
- Keep the `Co-Authored-By:` trailer on AI-assisted commits.

### Assets
- No NASA logos or mission patches. No AI-generated images. Every photo has a credit line.

### Shared files
- `docs/DATA_SOURCES.md` and `docs/DECISIONS.md` are append-only: anyone may add lines at the end,
  nobody rewrites or deletes existing lines. Correct a line by appending a new one that supersedes it.
- New idea mid-task: append one `- LATER: <what> — <why> — <hours> — <name>` line to
  `docs/DECISIONS.md` and go back to your task. Yusuf makes the scope call.

### Branches and PRs
- Branch names: `<directory>/<short-task-name>`, always from fresh `main`
  (`git fetch origin && git switch -c <dir>/<task> origin/main`).
- Small PRs. PRs merge within an hour; if yours can't, split it.

### Definition of done
A task is done when all three hold:
1. A runnable check passes (the directory's test command in its `CLAUDE.md`).
2. A small PR is open.
3. One line is added to `docs/ai-use/<name>.md`.

Use the `pr-ac` skill (`.claude/skills/pr-ac/SKILL.md`) to do all three. If the task is listed in
`docs/TASKS.md`, tick its box (`[x]` and the PR number) in the same PR.

## Ports and local URLs

| Service | Port | Dev proxy from web |
|---|---|---|
| planner | 8000 | `/api/planner/*` |
| mission-control | 8080 | `/api/mc/*`, `/ws` |
| web | 5173 | — |

## Live services (since 2026-11-14)

- **Where:** the web app is on Vercel (`https://ariadne-gilt-tau.vercel.app`). Planner,
  mission-control and the assets run on the Hetzner server, not on a laptop:
  `https://api.2-31-2-199.sslip.io`, `https://mc.2-31-2-199.sslip.io` (also `wss://…/ws`) and
  `https://assets.2-31-2-199.sslip.io/`. Details are in the last hosting entry of
  `docs/DECISIONS.md`. Nuri's laptop + Tailscale Funnel (`infra/funnel.sh`) is only the fallback.
- **Merges redeploy:** a merge to `main` that touches `planner/`, `mission-control/` or `infra/`
  (other than `.md` files) rebuilds the server within a few minutes (`.github/workflows/deploy.yml`).
  Mission-control keeps sessions in memory, so such a merge drops the open session and the cuff
  pairing. A merge into `web/`, `contracts/` or `content/` redeploys the Vercel site
  (`.github/workflows/web-deploy.yml`).
- **Merge freeze:** no merges into those three folders during a live run, a rehearsal, the video
  shoot or the judging. After the Sun 11:00 feature freeze, merge there only bug fixes, and tell
  the group before merging.
- **New asset bundles** (`pipeline/scripts/07_bundle.sh`) go to the server's `/srv/assets`, followed
  by a planner restart; not to a laptop. Steps: `infra/CLAUDE.md` ("New asset bundle"). Server access: Yusuf and
  Nuri (`ssh deploy@2.31.2.199`).
- **Secrets:** server secrets live only in the server's `infra/.env`, CI secrets only in the repo
  settings. Never in git.

## Checks per directory

| Directory | Check |
|---|---|
| `contracts/` | `python contracts/check.py` |
| `web/` | `cd web && npm run check` |
| `planner/` | `cd planner && python -m pytest` |
| `mission-control/` | `cd mission-control && go vet ./... && go test ./...` |

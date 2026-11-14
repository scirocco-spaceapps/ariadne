# Ariadne

## What it is

Ariadne is a walking-scale Mars EVA map for Bright Angel in Jezero crater. It layers NASA data,
plans a science walk, and shows at every moment whether the astronaut can still get back to the
safe haven. Built for NASA Space Apps 2026.

Three parts talk through the contracts in [`contracts/`](contracts/):

- **planner** (Python, FastAPI) plans routes between stops and abort paths home.
- **mission-control** (Go, Fiber) runs the EVA simulation, fetches conditions, and streams state
  over WebSocket.
- **web** (Vite, React, deck.gl) shows the mission console (`/`) and the astronaut's cuff (`/cuff`).

All positions are metres in a local plane (x east, y north, from the AOI south-west corner).

## Run locally

Requirements: Node 22+, Python 3.11+, Go 1.23+.

```bash
# planner (port 8000)
cd planner && python -m venv .venv && . .venv/Scripts/activate && pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# mission-control (port 8080)
cd mission-control && go run .

# web (port 5173, proxies /api/planner, /api/mc and /ws)
cd web && npm install && npm run dev
```

Checks: `python contracts/check.py`, `cd web && npm run check`, `cd planner && python -m pytest`,
`cd mission-control && go test ./...`.

Until real data lands every part runs on the SYNTHETIC fixtures in `contracts/fixtures/`.

## Data sources

Every value shown in the app carries a provenance label (Observed, Derived, Modeled, Assumed,
Simulation). The full list of values, their sources and provenance is in
[`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md). Values without a published source are marked
Assumed.

## AI use

We use AI coding assistants (Claude Code) to write code and docs. Every AI-assisted commit keeps a
`Co-Authored-By:` trailer, and each team member logs one line per finished task in
[`docs/ai-use/`](docs/ai-use/). No AI-generated images are used anywhere in the project, and AI is
never used to produce measurements.

## Limitations

- Fixture rasters, routes, conditions and stop content are SYNTHETIC placeholders.
- The safe haven and the five stops in `contracts/aoi.json` are Perseverance waypoints (Derived); the
  Masonic Temple position is inferred from a published abrasion sol, not named by NASA for that sol.
- EVA budget, reserve, slope limits and walking speed are lunar EVA planning values adopted for Mars
  (Assumed, with sources in [`docs/model.md`](docs/model.md)).
- The walk model is a planning aid for a hackathon demo, not a validated EVA safety tool.
- Conditions data may be stale or missing; the app shows that instead of filling gaps.

# mission-control/

**Owner:** Mazlum.

**Purpose:** Go + Fiber service that runs the EVA simulation: fetches conditions (weather,
radiation, space weather, partner data), holds sessions, advances the clock, and pushes state to the
console and the cuff over WebSocket. HTTP API: `contracts/openapi.yaml` (tag `mission-control`).
WebSocket: `contracts/ws-messages.md`. All simulated state carries `provenance: "Simulation"`.

**Run:** `cd mission-control && go run .` (port from `PORT`, default 8080)

**Env:** `PORT` (8080), `WEB_ORIGIN` (CORS allow list, comma-separated; default
`http://localhost:5173`), `PLANNER_URL` (planner base URL for `POST /abort` on a storm alert;
empty or failing → the request's `abort_path`, else the way already walked, reversed),
`NASA_API_KEY` (DONKI; empty → `DEMO_KEY`, 30 requests/hour), `MODEL_PARAMS_PATH` (default
`../model/params.json`) and `MEDA_PATH` (default `../content/conditions/meda.json`). The default
paths assume you run from `mission-control/`. `SESSION_TTL` (default `2h`): a session nobody
listens to and whose clock is stopped is removed after this long.

**Robustness:** logs are JSON lines on stdout (`log/slog`). WebSockets get a ping every 20 s and
are dropped after 60 s without a pong. Reconnecting with the same session id gets the current
state. `/events` allows 10 calls per session per 10 s (429 above that). SIGINT/SIGTERM shut down
gracefully.

**Rehearsal:** `POST /sessions/{id}/script {"name":"demo90"}` resets, starts at speed 6, raises a
storm alert (lead 30 min, a scenario value) halfway through the first walk after the first dwell,
walks home and clears 6 s after arrival. A `reset` or `seek` stops it.

**Race detector:** `go test -race ./...` needs cgo (a C compiler); run it on Linux or in CI.

**Conditions:** DONKI WSA-ENLIL arrivals at Mars over the last 30 days, cached 15 min; on failure
the last good copy with `stale: true`. Radiation and weather are read on every request, so a new
`params.json` or `meda.json` shows up without a restart. Test data
`internal/conditions/testdata/` is a real DONKI response recorded on 2026-11-14.

**Docker:** `docker build -t ariadne-mission-control mission-control` (context = this folder).

**Layout:** `internal/contract` message shapes, `internal/session` sessions, clock and hub,
`internal/sim` the astronaut walking the route timeline, `internal/conditions` GET /conditions,
`internal/server` HTTP and WebSocket routes.

**Test:** `cd mission-control && go vet ./... && go test ./...`

**Rules:** a condition part that cannot be fetched is `null` with a reason in `missing`; never fill
it with a made-up number. Replay `contracts/fixtures/ws-state.jsonl` to test clients.

**Must not touch:** `contracts/`, `planner/`, `web/`, root config, CI.

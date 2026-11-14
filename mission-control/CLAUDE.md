# mission-control/

**Owner:** Mazlum.

**Purpose:** Go + Fiber service that runs the EVA simulation: fetches conditions (weather,
radiation, space weather, partner data), holds sessions, advances the clock, and pushes state to the
console and the cuff over WebSocket. HTTP API: `contracts/openapi.yaml` (tag `mission-control`).
WebSocket: `contracts/ws-messages.md`. All simulated state carries `provenance: "Simulation"`.

**Run:** `cd mission-control && go run .` (port from `PORT`, default 8002)

**Test:** `cd mission-control && go vet ./... && go test ./...`

**Rules:** a condition part that cannot be fetched is `null` with a reason in `missing`; never fill
it with a made-up number. Replay `contracts/fixtures/ws-state.jsonl` to test clients.

**Must not touch:** `contracts/`, `planner/`, `web/`, root config, CI.

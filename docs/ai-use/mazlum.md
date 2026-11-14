# AI use — Mazlum

- 2026-11-14 | mission-control/m1-hub (PR pending) | Claude Code | wrote the Fiber session store, WebSocket hub (hello, 4404/4400, 2 Hz) and tests | read the diff, ran go vet and go test
- 2026-11-14 | mission-control/m2-simulator (PR pending) | Claude Code | wrote the route-timeline simulator and /control (start, pause, reset, seek) with position tests | read the diff, ran go vet and go test
- 2026-11-14 | mission-control/m3-events (PR pending) | Claude Code | wrote /events: storm alert, planner /abort client with fallbacks, arrival, clear and resume, with tests | read the diff, ran go vet and go test
- 2026-11-14 | infra/n2-deploy (PR pending) | Claude Code | wrote docker-compose, Caddyfile, deploy.sh and the SSH deploy workflow (Nuri's card, Nuri away) | ran docker compose config; Caddy and the server not verified
- 2026-11-14 | web/n1-shell (PR pending) | Claude Code | wrote the zustand store, REST and WebSocket clients, DEMO replay, host configs and CI lint/pipeline jobs (Nuri's card, Nuri away) | ran npm run check and npm run lint
- 2026-11-14 | mission-control/m4-conditions (PR pending) | Claude Code | wrote GET /conditions: DONKI WSA-ENLIL Mars arrivals (15 min cache, stale copy on failure), radiation from params.json, MEDA weather, null + reason when missing; tests on a recorded real DONKI response | inspected a real DONKI response, ran go vet and go test, validated live /conditions against the openapi schema

# WebSocket messages — mission-control

Endpoint: `ws://localhost:8080/ws?s=<session id>&role=console|cuff`
(through the web dev proxy: `ws://localhost:5173/ws?...`).

Schemas for every message below are in `openapi.yaml` under `components/schemas`
(`WsState`, `WsEvent`, `WsHello`, `WsServerMessage`), so web types and fixture checks come from the
same source. Example stream: `fixtures/ws-state.jsonl`.

All messages are JSON text frames, one message per frame. Coordinates are local metres `[x, y]`
(x east, y north, from the AOI south-west corner). Times are minutes from EVA start.

## Lifecycle

1. Client opens the socket with a session id from `POST /sessions` and its role.
   Unknown session → server closes with code `4404`. Bad role → `4400`.
2. Client sends `hello` as its first frame.
3. Server immediately sends one `state`, then a `state` every 500 ms of wall-clock time (2 Hz)
   while running, and at once after every control, event or script call, even when paused.
   Clients must not depend on the exact rate: interpolate `pos` between states if needed.
4. Server sends `event` frames when something happens; the next `state` already reflects it.
5. Either side may close; clients reconnect and send `hello` again. No message replay: the first
   `state` after reconnect is the truth.

Console and cuff receive identical messages; the role only tells the server who is listening.

## Server → client

### `state`

```json
{"type":"state","session":"fx-session","t_min":12.0,"running":true,"speed":1,
 "pos":[163.2,140.1],"leg":0,"at_stop":null,"visited":[],
 "alert":null,"abort_path":null,"provenance":"Simulation"}
```

| Field | Type | Meaning |
|---|---|---|
| `type` | `"state"` | |
| `session` | string | Session id. |
| `t_min` | number | Simulated minutes since EVA start. |
| `running` | boolean | Clock is advancing. |
| `speed` | number | Simulated minutes per real second. |
| `pos` | `[x, y]` | Astronaut position, local metres. |
| `leg` | integer \| null | Index into `route.legs` while walking the plan; `null` while dwelling, before start, after the end, and while walking `abort_path`. |
| `at_stop` | string \| null | Stop id while dwelling there, else `null`. |
| `visited` | string[] | Stop ids whose full dwell has finished, in order. A dwell cut short by an alert does not count. |
| `alert` | null \| `{type, lead_min, since_t}` | Active alert. `type` is `"storm_alert"`; `lead_min` is minutes until arrival as of `since_t`; `since_t` is the `t_min` when it was raised. |
| `abort_path` | null \| `[[x, y], ...]` | Path home to show while an alert is active. |
| `provenance` | `"Simulation"` | Always. |

### `event`

```json
{"type":"event","name":"storm_alert","t_min":40.0}
```

| Field | Type | Meaning |
|---|---|---|
| `type` | `"event"` | |
| `name` | `"storm_alert"` \| `"clear"` \| `"arrived"` | `storm_alert`: alert raised. `clear`: alert cleared. `arrived`: reached a stop or the safe haven (see `at_stop` / `pos` in the next `state`). |
| `t_min` | number | When it happened. |

## Alert, abort and clear

- `storm_alert`: the server sets `alert`, sets `abort_path` (from planner `POST /abort` at the
  current position, or the request's `abort_path` if the planner fails), ends any dwell, and walks
  `abort_path` to the safe haven with `leg = null`, `at_stop = null`. It sends `arrived` on reaching
  the safe haven and then stops the clock (`running = false`).
- Time left before the storm, for any client: `alert.lead_min - (t_min - alert.since_t)`.
  `lead_min` never changes after the alert is raised.
- `clear`: `alert` and `abort_path` become `null`. If the astronaut has not reached the safe haven,
  the plan resumes from the current position toward the next unvisited stop.

## Client → server

### `hello`

```json
{"type":"hello","role":"cuff"}
```

| Field | Type | Meaning |
|---|---|---|
| `type` | `"hello"` | |
| `role` | `"console"` \| `"cuff"` | Must match the `role` query parameter. |

Clients send nothing else. Control and events go through HTTP
(`POST /sessions/{id}/control`, `POST /sessions/{id}/events`).

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
3. Server immediately sends one `state`, then a `state` on every simulation tick while running,
   and after every control or event call even when paused.
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
| `leg` | integer \| null | Index into `route.legs` while walking; `null` while dwelling, before start, or after the end. |
| `at_stop` | string \| null | Stop id while dwelling there, else `null`. |
| `visited` | string[] | Stop ids whose dwell has finished, in order. |
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

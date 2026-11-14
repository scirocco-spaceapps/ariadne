
## 2026-11-14 — from Nuri (task N4): serve a session's route, if Yusuf adds it to the contract

- **What:** `GET /sessions/{id}` returning the stored `SessionCreate` body (route, budget, reserve,
  dwell); 404 for an unknown session. Only after Yusuf adds it to `contracts/openapi.yaml`
  (note in `docs/notes/yusuf.md`).
- **Why:** the cuff (another device) needs the route for next stop / distance / ETA; today it
  re-plans from the stop order in the pairing URL. LATER, not needed for the demo.

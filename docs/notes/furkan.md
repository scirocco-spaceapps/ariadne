# Notes for Furkan

Owner of this file: Furkan (`content/`, `web/src/stops/`, `e2e/`, `docs/submission/`). Delete each note in the PR that handles it.

## 2026-11-14 — from Yusuf (Y8): demo90 in live mode stops at the last clock check

- **What:** `E2E_MODE=live E2E_BASE_URL=https://ariadne-gilt-tau.vercel.app` (after #83) passes
  start, both clocks in step, the storm alert on both screens, the red thread, clear and the
  recovery checks, then fails at the last `expectClocksAdvance` after clear: the console clock stays
  at T+10 (two runs, same result).
- **Why:** the test sends the alert about 2.5 s after Start, when the astronaut is still at the safe
  haven (cuff: "Walk home 0 min"). It reaches home, and `ws-messages.md` says the clock then stops
  (`running = false`) and `clear` resumes the plan only if the astronaut is not home yet. So the
  service follows the contract; the live expectation does not hold for an early alert.
- **Fix (your call, in `e2e/`):** in live mode send the alert once the astronaut is on the way
  (e.g. wait until the console clock is past T+12 at speed 6, or the cuff shows a non-zero walk
  home), or accept a stopped clock after clear when the astronaut is at the haven.
- **For the demo:** give the storm alert mid-walk, not right after Start, so "walk home" is not 0.

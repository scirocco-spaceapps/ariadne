# e2e/

**Owner:** Furkan.

**Purpose:** end-to-end tests that run web + planner + mission-control together against
`contracts/fixtures/` and check the user-visible flow (plan a walk, start a session, receive a
storm alert, see the abort path on console and cuff).

**Tests:** `tests/demo90.spec.ts` (task F4): console and cuff (two browser contexts) stay in step
(clock and position), a storm alert reaches both, the console draws the red thread home, and both
recover on clear. Records a video of each screen and screenshots per phase.

**Run / test:**

```bash
cd web && npm ci            # the test starts the web dev server from ../web
cd e2e && npm ci && npx playwright install chromium
npm test                    # = npm run check; DEMO mode, starts `npm run dev` in ../web on 5173
```

A dev server already on 5173 is reused locally (not in CI). DEMO waits for the start of the
fixture loop, so a run takes 30-60 s.

**Timing (DEMO):** the replay is locked to the wall clock (0.5 s per fixture minute, a 33 s loop).
A GPU-less CI runner can take seconds per map screenshot, so the test never assumes where in the
loop it is: before each phase it waits for the replay to reach it (`waitForReplay`), in this loop or
the next, and screenshots count only if the alert state is the same before and after the capture.
Console and cuff are read in parallel when compared. In DEMO each screen must show a coherent
fixture frame (time and position from `ws-state.jsonl`), and the two may be up to 3 frames (1.5 s)
apart: on CI the console draws the WebGL map on the CPU and applies frames about 1 s late. Live mode
still requires the exact same state. A slow run can take 2-3 loops (up to 240 s).
`E2E_CPU_THROTTLE=4 npm test` slows both pages 4x to reproduce a slow runner locally.

**Env:**
- `E2E_MODE=demo` (default): the app replays `contracts/fixtures/ws-state.jsonl` (SYNTHETIC,
  storm alert t = 30, home t = 38, clear t = 50). Needs no service. This is what CI runs.
- `E2E_MODE=live`: real session; needs planner (8000) and mission-control (8080) behind the dev
  proxy. The test clicks Create session, Start (speed 1 min/s), Storm alert and Clear.
- `E2E_BASE_URL`: test a web app that is already running instead of starting one. DEMO mode reads
  the console's position from the store through the Vite dev server, so it needs a dev server.

**Artifacts:** `test-results/<test>/` (videos `video-console/`, `video-cuff/`, screenshots
`01-running`, `02-alert`, `02b-home`, `03-clear` for console and cuff) and `playwright-report/`
(`npm run report`). CI uploads both as the `e2e-demo90` artifact. Both folders are gitignored.

**If the test breaks:** name the directory whose change broke it (web, mission-control, …) and
tell its owner; do not fix their code from here.

**Must not touch:** service code; if a test needs a hook in a service, write a note to its owner.

# e2e/

**Owner:** Furkan.

**Purpose:** end-to-end tests that run web + planner + mission-control together against
`contracts/fixtures/` and check the user-visible flow (plan a walk, start a session, receive a
storm alert, see the abort path on console and cuff).

**Run / test:** not set up yet. The test runner (e.g. Playwright) needs Nuri's OK as a new
dependency and gets its own `package.json` here.

**Must not touch:** service code; if a test needs a hook in a service, write a note to its owner.

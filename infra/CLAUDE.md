# infra/

**Owner:** Nuri (also owns `.github/`).

**Purpose:** deployment and hosting: container files, asset hosting for `assets_base`, dev scripts
that start all services. CI lives in `.github/workflows/`.

**Run / test:** not set up yet. Each script added here documents its command in this file.

**Must not touch:** service code. Secrets never go in git; use `.env` (git-ignored) and CI secrets.

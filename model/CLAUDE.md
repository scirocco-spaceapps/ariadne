# model/

**Owner:** Bunyamin.

**Purpose:** parameters of the walking model (speed vs slope, dwell, budget, reserve) used by the
planner and the simulation. `params.json` is the only interface; every value carries `provenance`
and `source`. Method write-up lives in `docs/model.md`, validation in `docs/validation.md`.

**Run:** nothing to run; edit `params.json`. Exploration happens in `notebooks/`.

**Test:** `python -c "import json; json.load(open('model/params.json'))"` until a schema exists.
A value with no published source is `Assumed` and listed in `docs/DATA_SOURCES.md`.

**Must not touch:** `planner/` code (write a note to Ali Koray), `contracts/`, root config, CI.

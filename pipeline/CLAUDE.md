# pipeline/

**Owner:** Ali Koray.

**Purpose:** offline scripts that turn NASA products (orthoimage, DEM, derived slope) into the
files listed in `contracts/aoi.json`, in the local metric plane (x east, y north, metres from the
AOI south-west corner; rasters north-up, row 0 north). Raw downloads go in `data/` (git-ignored).

**Run:** `python -m venv .venv && .venv/Scripts/activate` (Windows) or `source .venv/bin/activate`,
then `pip install -r pipeline/requirements.txt` and `python pipeline/scripts/<script>.py`.

**Test:** each script gets a `--check` mode or a pytest under `pipeline/tests/`; outputs must pass
the size rules in `contracts/check.py` when pointed at a real AOI.

**Rules:** every product you write gets a line in `docs/DATA_SOURCES.md` (value, source, provenance).
Never commit rasters from real data; they go to the asset host (`assets_base`).

**Must not touch:** `contracts/` (write a note to Yusuf), `planner/` code that is not a pipeline
script, root config, CI.

# planner/

**Owner:** Ali Koray.

**Purpose:** FastAPI service that plans the science walk and abort paths on the AOI rasters.
Endpoints are defined in `contracts/openapi.yaml` (tag `planner`): `GET /health`, `POST /route`,
`POST /abort`. Responses carry `provenance` (`Modeled` for computed routes).

**Run:**
```
cd planner
python -m venv .venv && .venv/Scripts/activate   # Windows; source .venv/bin/activate elsewhere
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

**Test:** `cd planner && python -m pytest`

**Data:** at startup the planner loads `AOI_PATH` (default `DATA_DIR/aoi.json`) and, from
`DATA_DIR/<assets_base>`, `cost_2m.f32` (required, min/m, NaN = impassable; written by
pipeline `04_cost.py`), `dem_4m.f32` (required) and `slope_2m.f32` (optional). If a file is missing,
`/health` still answers and `/route` and `/abort` return 422 with the reason. Local run with
real assets: `DATA_DIR=~/ariadne-data/assets uvicorn app.main:app --port 8000`. Requests longer than
`PLANNER_TIMEOUT_S` (default 5 s) or routes with more than 30 stops answer 422.

**Rules:** read rasters per `contracts/aoi.json`; until real data lands use `contracts/fixtures/`.
Coordinates in and out are local metres `[x, y]`, never lon/lat.

**Must not touch:** `contracts/`, `pipeline/` outputs, `web/`, `mission-control/`, root config, CI.

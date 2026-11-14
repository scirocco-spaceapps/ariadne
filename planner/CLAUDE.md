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

**Rules:** read rasters per `contracts/aoi.json`; until real data lands use `contracts/fixtures/`.
Coordinates in and out are local metres `[x, y]`, never lon/lat.

**Must not touch:** `contracts/`, `pipeline/` outputs, `web/`, `mission-control/`, root config, CI.

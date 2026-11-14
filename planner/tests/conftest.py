"""Synthetic DATA_DIR for planner tests (SYNTHETIC: not real data)."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"
SPEC_URI = "urn:ariadne:openapi"
_spec = yaml.safe_load((CONTRACTS / "openapi.yaml").read_text(encoding="utf-8"))
_registry = Registry().with_resource(SPEC_URI, Resource(contents=_spec, specification=DRAFT202012))

SIZE = (40, 32)  # metres; cost grid 20 x 16 at 2 m, DEM 10 x 8 at 4 m
SPEED = 50.0  # m/min, SYNTHETIC
WALL_COLS = (9, 10)  # x 18..22 m
WALL_ROWS = range(4, 16)  # y 0..24 m; gap at the top (y 24..32)


def schema_errors(instance, name: str) -> list[str]:
    v = Draft202012Validator({"$ref": f"{SPEC_URI}#/components/schemas/{name}"}, registry=_registry)
    return [f"{list(e.absolute_path)}: {e.message}" for e in v.iter_errors(instance)]


def write_data_dir(root: Path, *, stops=None, slope: bool = True, cost_override=None) -> Path:
    base = root / "assets"
    base.mkdir(parents=True, exist_ok=True)
    w, h = SIZE
    cost = np.full((h // 2, w // 2), 1.0 / SPEED, dtype="<f4")
    for c in WALL_COLS:
        cost[list(WALL_ROWS), c] = np.nan
    if cost_override is not None:
        cost_override(cost)
    cost.tofile(base / "cost_2m.f32")
    xs = (np.arange(w // 4) + 0.5) * 4
    dem = np.tile(0.1 * xs, (h // 4, 1)).astype("<f4")  # ramp rising east, 0.1 m/m
    dem.tofile(base / "dem_4m.f32")
    if slope:
        np.full((h // 2, w // 2), np.degrees(np.arctan(0.1)), dtype="<f4").tofile(base / "slope_2m.f32")
    aoi = {
        "id": "synthetic", "name": "SYNTHETIC planner test AOI", "size_m": list(SIZE), "assets_base": "assets/",
        "rasters": {
            "dem": {"file": "dem_4m.f32", "px_m": 4, "dtype": "float32", "unit": "m"},
            "slope_values": {"file": "slope_2m.f32", "px_m": 2, "dtype": "float32", "unit": "deg", "optional": True},
        },
        "safe_haven": {"id": "haven", "name": "SYNTHETIC haven", "xy": [3, 3]},
        "stops": stops if stops is not None else [
            {"id": "s1", "name": "SYNTHETIC s1", "xy": [37, 29]},
            {"id": "s2", "name": "SYNTHETIC s2", "xy": [37, 3]},
        ],
        "model": {"budget_min": 240, "reserve_min": 30, "dwell_min": 20},
    }
    (root / "aoi.json").write_text(json.dumps(aoi), encoding="utf-8")
    return root


@pytest.fixture
def make_client(tmp_path, monkeypatch):
    clients = []

    def _make(**kw) -> TestClient:
        d = write_data_dir(tmp_path / f"d{len(clients)}", **kw)
        monkeypatch.setenv("DATA_DIR", str(d))
        monkeypatch.delenv("AOI_PATH", raising=False)
        from app.main import app

        c = TestClient(app)
        c.__enter__()  # runs the lifespan, which loads the data
        clients.append(c)
        return c

    yield _make
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()

import math
from pathlib import Path

import numpy as np
import pytest

from app.routing import MAX_VERTICES, simplify

from .conftest import SPEED, WALL_COLS, WALL_ROWS, schema_errors


def _vertex_on_wall(path) -> bool:
    """True if a path vertex lies in a wall cell. Segments between vertices may cut a wall corner by
    up to the simplification tolerance (half a cell); the underlying cell path never enters a wall."""
    for x, y in path:
        col, row = int(x // 2), int((32 - y) // 2)
        if col in WALL_COLS and row in WALL_ROWS:
            return True
    return False


def test_route_matches_contract_and_detours_around_wall(client):
    r = client.post("/route", json={"stops": ["s2", "s1"], "return_home": True})
    assert r.status_code == 200, r.text
    body = r.json()
    assert schema_errors(body, "RouteResponse") == []
    assert body["provenance"] == "Modeled"
    assert [(leg["from"], leg["to"]) for leg in body["legs"]] == [("haven", "s2"), ("s2", "s1"), ("s1", "haven")]

    leg0 = body["legs"][0]
    assert leg0["path"][0] == [3, 3] and leg0["path"][-1] == [37, 3]
    assert not _vertex_on_wall(leg0["path"])
    # Straight line is 34 m; the wall forces a detour over the gap at y >= 24.
    assert max(y for _, y in leg0["path"]) >= 24
    assert leg0["distance_m"] > 2 * 21 + 14
    # Time is distance / speed on uniform cost (cell-centre path vs exact endpoints: within 5 %).
    assert leg0["time_min"] == pytest.approx(leg0["distance_m"] / SPEED, rel=0.05)
    # Ramp 0.1 m/m rising east: climb ~ 0.1 * eastward displacement, slope atan(0.1).
    assert leg0["climb_m"] == pytest.approx(0.1 * (37 - 3), abs=0.6)
    assert leg0["max_slope_deg"] == pytest.approx(math.degrees(math.atan(0.1)), abs=0.01)


def test_timeline_and_totals(client):
    body = client.post("/route", json={"stops": ["s1", "s2"], "return_home": False}).json()
    tl = body["timeline"]
    assert [i["kind"] for i in tl] == ["walk", "dwell", "walk", "dwell"]
    assert [i.get("stop") for i in tl if i["kind"] == "dwell"] == ["s1", "s2"]
    for a, b in zip(tl, tl[1:]):
        assert b["t0_min"] == pytest.approx(a["t1_min"], abs=0.02)
    t = body["totals"]
    assert t["dwell_min"] == 40
    assert t["walk_min"] == pytest.approx(sum(leg["time_min"] for leg in body["legs"]), abs=0.02)
    assert t["eva_min"] == pytest.approx(t["walk_min"] + t["dwell_min"], abs=0.02)
    assert tl[-1]["t1_min"] == pytest.approx(t["eva_min"], abs=0.05)


def test_unknown_stop_is_422_with_detail(client):
    r = client.post("/route", json={"stops": ["nope"], "return_home": False})
    assert r.status_code == 422
    assert "nope" in r.json()["detail"]
    assert schema_errors(r.json(), "Error") == []


def test_unreachable_stop_is_422(make_client):
    def box_in_s1(cost):  # walls around the cell of s1 at (37, 29) -> row 1, col 18
        for r in range(0, 4):
            for c in range(16, 20):
                if (r, c) != (1, 18):
                    cost[r, c] = np.nan

    c = make_client(cost_override=box_in_s1)
    r = c.post("/route", json={"stops": ["s1"], "return_home": False})
    assert r.status_code == 422
    assert "no passable path" in r.json()["detail"]


def test_bad_request_shape_is_422(client):
    assert client.post("/route", json={"stops": [], "return_home": True}).status_code == 422
    assert client.post("/route", json={"stops": ["s1"]}).status_code == 422
    assert client.post("/route", json={"stops": ["s1"], "return_home": True, "x": 1}).status_code == 422


def test_max_slope_from_dem_when_slope_raster_missing(make_client):
    c = make_client(slope=False)
    leg = c.post("/route", json={"stops": ["s2"], "return_home": False}).json()["legs"][0]
    assert 0 <= leg["max_slope_deg"] <= math.degrees(math.atan(0.1)) + 0.5


def test_simplify_caps_vertices_and_keeps_endpoints():
    t = np.linspace(0, 40 * math.pi, 5000)
    pts = np.c_[t * 10, np.sin(t) * 50]
    out = simplify(pts, 2.0)
    assert len(out) <= MAX_VERTICES
    assert (out[0] == pts[0]).all() and (out[-1] == pts[-1]).all()


def test_route_on_real_data_under_2_seconds():
    """Runs only when the real assets are present (PLANNER_REAL_DATA_DIR)."""
    import os
    import time

    d = os.environ.get("PLANNER_REAL_DATA_DIR")
    if not d or not (Path(d) / "aoi.json").exists():
        pytest.skip("real data not available")
    from app import plan

    data = plan.load(Path(d), Path(d) / "aoi.json")
    t0 = time.perf_counter()
    plan.plan_route(data, list(data.stops), True)
    assert time.perf_counter() - t0 < 2.0

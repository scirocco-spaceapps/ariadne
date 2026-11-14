import importlib.util
import math

import numpy as np
import pytest

from aoi import REPO, load_frame
from homecost import cost_to_home, path_from

SPEED = 50.0  # m/min, SYNTHETIC
PX = 2.0


def wall_grid():
    """5 x 5 cells, wall in column 2 for rows 0-3; the only gap is row 4 (south edge)."""
    c = np.full((5, 5), 1.0 / SPEED)
    c[0:4, 2] = np.nan
    return c


def test_toy_grid_with_wall_matches_hand_computation():
    minutes, pred = cost_to_home(wall_grid(), PX, (0, 0))
    # From (0, 0) to (0, 4) the walk must pass (4, 2): to get there, 2 straight + 2 diagonal steps,
    # and the same back up: 4 + 4 * sqrt(2) cells, x 2 m per cell, at 50 m/min.
    expected = (4 + 4 * math.sqrt(2)) * PX / SPEED
    assert minutes[0, 4] == pytest.approx(expected, rel=1e-9)
    # Straight neighbours on open ground: one cell = 2 m / 50 m/min.
    assert minutes[1, 0] == pytest.approx(PX / SPEED)
    assert minutes[1, 1] == pytest.approx(math.sqrt(2) * PX / SPEED)
    assert minutes[0, 0] == 0
    assert np.isnan(minutes[0:4, 2]).all()  # wall cells unreachable


def test_traceback_reaches_haven_around_the_wall():
    _, pred = cost_to_home(wall_grid(), PX, (0, 0))
    path = path_from(pred, (0, 4))
    assert path[0] == (0, 4) and path[-1] == (0, 0)
    assert (4, 2) in path
    assert all(not (c == 2 and r < 4) for r, c in path)
    assert pred[0, 0] == -1


def test_enclosed_cells_are_nan_and_have_no_predecessor():
    c = np.full((5, 5), 1.0 / SPEED)
    c[0:3, 2] = np.nan
    c[2, 2:5] = np.nan  # box around the top-right 2 x 2 corner
    minutes, pred = cost_to_home(c, PX, (4, 0))
    assert np.isnan(minutes[0:2, 3:5]).all()
    assert (pred[0:2, 3:5] == -1).all()
    assert path_from(pred, (0, 4)) == [(0, 4)]


def test_impassable_haven_is_an_error():
    with pytest.raises(ValueError):
        cost_to_home(wall_grid(), PX, (0, 2))


def _sites_module():
    spec = importlib.util.spec_from_file_location("sites", REPO / "pipeline" / "scripts" / "05a_sites.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_sites_conversion_flags_outside_and_impassable():
    sites = _sites_module()
    frame = load_frame()
    cost = np.full((1000, 1250), 1.0 / SPEED, dtype="float32")
    cost[500, 625] = np.nan  # the cell under the second stop
    lon_h, lat_h = frame.aoi_to_lonlat(400.0, 300.0)
    lon_a, lat_a = frame.aoi_to_lonlat(1251.0, 999.0)
    lon_b, lat_b = frame.aoi_to_lonlat(-50.0, 100.0)
    entries = [
        {"id": "haven", "name": "SYNTHETIC haven", "lon": float(lon_h), "lat": float(lat_h)},
        {"id": "a", "name": "SYNTHETIC a", "lon": float(lon_a), "lat": float(lat_a)},
        {"id": "b", "name": "SYNTHETIC b", "lon": float(lon_b), "lat": float(lat_b)},
    ]
    haven, stops, problems = sites.convert(entries, frame, cost, 2.0)
    assert haven["xy"] == pytest.approx([400.0, 300.0], abs=0.1)
    assert [s["id"] for s in stops] == ["a", "b"]
    assert any("a (" in p and "impassable" in p for p in problems)
    assert any("b (" in p and "outside" in p for p in problems)

"""SYNTHETIC checks for validation.py. Run: python -m pytest notebooks/test_validation.py"""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validation as v  # noqa: E402


def test_densify_keeps_length():
    line = np.array([[0.0, 0.0], [10.0, 0.0], [10.0, 7.3]])
    p, l = v.densify(line)
    assert abs(l.sum() - 17.3) < 1e-9 and len(p) == len(l)


def test_slope_stats_shares_are_length_weighted():
    slope = np.array([5.0, 16.0, 25.0])
    length = np.array([8.0, 1.5, 0.5])
    s = v.slope_stats(slope, length, 15, 20)
    assert (s["go_share"], s["caution_share"], s["nogo_share"]) == (0.8, 0.15, 0.05)


def test_lookup_north_up():
    r = np.arange(6, dtype="float32").reshape(2, 3)  # row 0 is north
    out = v.lookup(r, 2.0, 4.0, np.array([1.0, 5.0, 9.0]), np.array([3.0, 1.0, 1.0]))
    assert out[0] == 0 and out[1] == 5 and np.isnan(out[2])


def test_divergences_on_parallel_paths():
    rover = np.array([[0.0, 0.0], [200.0, 0.0]])
    planned = np.array([[0.0, 0.0], [50.0, 0.0], [60.0, 40.0], [140.0, 40.0], [150.0, 0.0], [200.0, 0.0]])
    dv = v.divergences(planned, rover, limit=25.0)
    assert len(dv) == 1 and 39 <= dv[0]["max_off_m"] <= 40.5
    assert v.divergences(rover, rover) == []


def test_time_along_flags_no_go():
    cost = np.full((2, 4), 0.03, "float32")
    cost[:, 2:] = np.nan
    t, bad = v.time_along(np.array([[0.0, 1.0], [8.0, 1.0]]), cost, 2.0, (8.0, 4.0))
    assert abs(t - 4 * 0.03) < 1e-6 and abs(bad - 0.5) < 1e-9

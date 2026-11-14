"""SYNTHETIC checks for viewshed.py: behind a ridge is unseen, the track corridor is removed.

Run: python -m pytest notebooks/test_viewshed.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, str(Path(__file__).resolve().parent))
import viewshed as vs  # noqa: E402

PROJ = "+proj=eqc +lat_ts=18.4889 +lon_0=77.2989 +R=3396190 +units=m +no_defs"
W, H = 400, 300  # metres = pixels at 1 m


@pytest.fixture()
def ridge_grid(tmp_path: Path) -> vs.Grid:
    """Flat ground at 0 m with a 10 m high north-south wall at x = 200..205 m."""
    z = np.zeros((H, W), "float32")
    z[:, 200:206] = 10.0
    path = tmp_path / "dem.tif"
    with rasterio.open(path, "w", driver="GTiff", width=W, height=H, count=1, dtype="float32",
                       crs=rasterio.crs.CRS.from_proj4(PROJ), transform=from_origin(0, H, 1, 1)) as ds:
        ds.write(z, 1)
    return vs.read_dem(path, origin=(0.0, 0.0))


def test_frame_round_trip(ridge_grid):
    r, c = ridge_grid.aoi_to_rc(100.4, 150.6)
    x, y = ridge_grid.rc_to_aoi(r, c)
    assert (r, c) == (149, 100)
    assert abs(x - 100.5) < 1e-9 and abs(y - 150.5) < 1e-9


def test_behind_ridge_unseen(ridge_grid):
    count, _, used, _ = vs.times_seen(ridge_grid, [{"x": 100.5, "y": 150.5, "sol": 1}], height=2.0)
    assert len(used) == 1
    near_side = count[100:200, 120:190]
    far_side = count[100:200, 230:300]
    assert near_side.mean() > 0.99, "open ground in front of the ridge should be seen"
    assert far_side.max() == 0, "ground right behind a 10 m ridge must not be seen from 2 m height"


def test_max_distance(ridge_grid):
    count, closest, _, _ = vs.times_seen(ridge_grid, [{"x": 20.5, "y": 150.5, "sol": 1}], height=2.0)
    # 600 m limit is larger than this grid, so the whole near side is seen.
    # GDAL 3.4 marks a few cells next to the observer as unseen on perfectly flat ground (the sight
    # line grazes the surface); they lie inside the 10 m touched corridor anyway, so start at 3 m.
    assert count[150, 24:200].all()
    assert count[149, 21:200].all()
    # closest view is the distance to the observer
    assert abs(closest[149, 120] - 99.5) < 1.0


def test_only_close_views_count(ridge_grid):
    # observer at x = 20.5: ground beyond CLOSE_M (150 m) is seen but not a candidate
    res = vs.seen_not_touched(ridge_grid, [{"x": 20.5, "y": 150.5, "sol": 3}], [], height=2.0)
    assert res.count[100, 190] > 0
    assert not res.snt2[:, 90:].any(), "cells farther than 150 m are left out"
    assert res.snt2[:, 40:60].any()


def test_track_corridor_removed(ridge_grid):
    track = [np.array([[50.0, 150.0], [150.0, 150.0]])]
    res = vs.seen_not_touched(ridge_grid, [{"x": 100.5, "y": 150.5, "sol": 7}], track, height=2.0)
    # 1 m cells within 10 m of the track are touched
    assert res.touched[150, 100] and res.touched[141, 100] and not res.touched[138, 100]
    # the 2 m seen-not-touched layer has a hole along the track
    assert not res.snt2[75, 50]
    assert res.snt2[40, 50]
    # nothing behind the ridge
    assert not res.snt2[:, 115:150].any()


def test_targets_and_seen_from(ridge_grid):
    track = [np.array([[50.0, 150.0], [150.0, 150.0]])]
    res = vs.seen_not_touched(ridge_grid, [{"x": 100.5, "y": 150.5, "sol": 7, "rmc": "1_0"}], track, height=2.0)
    assert res.targets, "the seen side minus the corridor leaves at least one region"
    for t in res.targets:
        assert t["area_m2"] >= vs.MIN_AREA_M2
        assert t["area_m2"] <= vs.TILE_M ** 2
        assert t["sol"] == 7 and t["n_views"] == 1
        assert t["x"] <= 206, "targets lie in front of or on the ridge's near face, never behind it"
    assert len(res.targets) > 1, "the layer is split into tiles"
    assert {s["target"] for s in res.seen_from} == {t["id"] for t in res.targets}


def test_block_majority():
    m = np.zeros((4, 4), bool)
    m[0, 0] = m[0, 1] = True        # 2 of 4 -> True
    m[2, 2] = True                  # 1 of 4 -> False
    out = vs.block_majority(m, 2)
    assert out.tolist() == [[True, False], [False, False]]


def test_choose_keeps_ids_by_position(ridge_grid):
    track = [np.array([[50.0, 150.0], [150.0, 150.0]])]
    res = vs.seen_not_touched(ridge_grid, [{"x": 100.5, "y": 150.5, "sol": 7}], track, height=2.0)
    a, b = res.targets[0], res.targets[-1]
    chosen = vs.choose(res, {"target-a": (a["x"] + 5, a["y"]), "target-b": (b["x"], b["y"] - 5)})
    assert [t["id"] for t in chosen.targets] == ["target-a", "target-b"]
    assert chosen.targets[0]["candidate_id"] == a["id"]
    assert {s["target"] for s in chosen.seen_from} <= {"target-a", "target-b"}
    with pytest.raises(ValueError):
        vs.choose(res, {"target-far": (390.0, 290.0)})

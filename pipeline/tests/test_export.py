import json
import math

import numpy as np
import pytest

from exportlib import block_reduce, check_f32, hillshade, write_f32


def test_block_reduce_mean_and_max_ignore_nan():
    a = np.arange(16, dtype="float64").reshape(4, 4)
    a[0, 0] = np.nan
    assert block_reduce(a, 2).tolist() == [[(1 + 4 + 5) / 3, 4.5], [10.5, 12.5]]
    assert block_reduce(a, 2, "max").tolist() == [[5, 7], [13, 15]]
    with pytest.raises(ValueError):
        block_reduce(np.zeros((3, 4)), 2)


def test_hillshade_flat_and_sun_facing_slopes():
    flat = hillshade(np.zeros((5, 5)), 2.0)
    assert abs(int(flat[2, 2]) - math.sin(math.radians(45)) * 255) <= 1  # flat: sin(altitude)
    # North-up: z rising to the south-east faces north-west, toward a 315° sun -> brighter than flat.
    rows, cols = np.mgrid[0:9, 0:9]
    nw_facing = (rows + cols) * 0.5  # higher to the south (row) and east (col)
    se_facing = -nw_facing
    assert hillshade(nw_facing, 1.0)[4, 4] > flat[2, 2] > hillshade(se_facing, 1.0)[4, 4]


def test_write_f32_little_endian_sidecar_and_check(tmp_path):
    a = np.array([[1.0, 2.0, np.nan], [4.0, 5.0, 6.0]], dtype="float64")
    p = tmp_path / "x_4m.f32"
    meta = write_f32(p, a, 4.0, {"unit": "m"})
    assert meta["width"] == 3 and meta["height"] == 2 and meta["min"] == 1 and meta["max"] == 6
    raw = np.fromfile(p, dtype="<f4").reshape(2, 3)
    assert raw[0, 1] == 2.0 and np.isnan(raw[0, 2])
    assert json.loads((tmp_path / "x_4m.f32.json").read_text())["unit"] == "m"
    assert check_f32(p, (12, 8), 4.0) == []
    assert check_f32(p, (16, 8), 4.0)  # wrong size is reported

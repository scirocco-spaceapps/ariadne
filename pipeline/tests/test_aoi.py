import json

import pytest

from aoi import CONTRACT_AOI, FRAME_OVERRIDE, load_frame, pixel_centre, xy_to_pixel


@pytest.fixture(scope="module")
def frame():
    return load_frame()


# The effective frame must be the same whether the moved origin lives in pipeline/aoi_frame.json
# (before contracts PR #17) or in contracts/aoi.json (after it), so these tests check the frame,
# not which file holds the origin.
TASK_BOOK_ORIGIN = (77.27666, 18.47203)  # AOI centred on sol 1250 (task book), before the A1 shift
SOL_1250 = (77.29887363, 18.48891695)


def test_effective_origin_is_task_book_origin_moved_100_m_south(frame):
    tb_x, tb_y = frame._fwd.transform(*TASK_BOOK_ORIGIN)
    x0, y0 = frame.origin_proj
    assert x0 == pytest.approx(tb_x, abs=0.01)
    assert tb_y - y0 == pytest.approx(100, abs=0.05)


def test_sol_1250_sits_mid_east_west_and_100_m_north_of_centre(frame):
    x, y = frame.lonlat_to_aoi(*SOL_1250)
    assert x == pytest.approx(frame.size_m[0] / 2, abs=2)
    assert y == pytest.approx(frame.size_m[1] / 2 + 100, abs=2)


def test_override_if_present_agrees_with_or_replaces_the_contract():
    contract = load_frame(override=None)
    effective = load_frame()
    assert effective.proj4 == contract.proj4 and effective.size_m == contract.size_m
    if not FRAME_OVERRIDE.exists():
        assert effective.origin_lonlat == contract.origin_lonlat


def test_lonlat_round_trip(frame):
    for x, y in [(0, 0), (2500, 2000), (1234.5, 678.9)]:
        lon, lat = frame.aoi_to_lonlat(x, y)
        x2, y2 = frame.lonlat_to_aoi(lon, lat)
        assert (x2, y2) == pytest.approx((x, y), abs=1e-6)


def test_local_crs_has_true_scale_at_aoi_latitude(frame):
    # 0.01 deg of longitude at lat_ts is R * cos(lat_ts) * 0.01 * pi / 180 metres on the ground.
    import math

    lat = 18.4889
    x1, _ = frame.lonlat_to_aoi(77.29, lat)
    x2, _ = frame.lonlat_to_aoi(77.30, lat)
    assert x2 - x1 == pytest.approx(3396190 * math.cos(math.radians(lat)) * math.radians(0.01), rel=1e-6)


def test_pixel_centre_matches_contract_formula_and_north_up():
    h = 2000
    assert pixel_centre(0, 0, 2, h) == (1.0, 1999.0)  # row 0 = north edge
    assert pixel_centre(999, 1249, 2, h) == (2499.0, 1.0)
    for row, col in [(0, 0), (10, 20), (999, 1249)]:
        assert xy_to_pixel(*pixel_centre(row, col, 2, h), 2, h) == (row, col)


def test_contract_file_is_the_frame_source():
    aoi = json.loads(CONTRACT_AOI.read_text(encoding="utf-8"))
    f = load_frame()
    assert f.proj4 == aoi["crs"]["proj4"]
    assert list(f.size_m) == aoi["size_m"]

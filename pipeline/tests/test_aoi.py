import json

import pytest

from aoi import CONTRACT_AOI, FRAME_OVERRIDE, load_frame, pixel_centre, xy_to_pixel


@pytest.fixture(scope="module")
def frame():
    return load_frame()


def test_contract_origin_is_sw_corner_of_aoi_centred_on_sol_1250():
    # With the contract origin, sol 1250 (77.29887 E, 18.48892 N) sits at the AOI centre (+- 2 m).
    f = load_frame(override=None)
    x, y = f.lonlat_to_aoi(77.29887363, 18.48891695)
    assert x == pytest.approx(f.size_m[0] / 2, abs=2)
    assert y == pytest.approx(f.size_m[1] / 2, abs=2)


def test_override_moves_origin_100_m_south_only():
    base = load_frame(override=None)
    moved = load_frame()
    if not FRAME_OVERRIDE.exists():
        pytest.skip("no frame override")
    (bx, by), (mx, my) = base.origin_proj, moved.origin_proj
    assert mx == pytest.approx(bx, abs=0.01)
    assert by - my == pytest.approx(100, abs=0.05)
    assert moved.proj4 == base.proj4 and moved.size_m == base.size_m


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

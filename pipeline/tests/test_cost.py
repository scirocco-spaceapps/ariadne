import json
import math

import numpy as np
import pytest

from slopecost import (CAUTION, GO, NOGO, aggregate_max, classify, colour_classes, colour_slope, cost_min_per_m,
                       load_params, slope_horn)

# SYNTHETIC params for tests only.
PARAMS = {
    "max_slope_deg": {"value": 25, "unit": "deg", "provenance": "Assumed", "source": "test"},
    "caution_slope_deg": {"value": 15, "unit": "deg", "provenance": "Assumed", "source": "test"},
    "walk_speed_flat_m_per_min": {"value": 60, "unit": "m/min", "provenance": "Assumed", "source": "test"},
    "speed_vs_slope": {"value": [[0, 1.0], [20, 0.5], [30, 0.25]], "unit": "pairs", "provenance": "Assumed",
                       "source": "test"},
}


@pytest.fixture
def model(tmp_path):
    p = tmp_path / "params.json"
    p.write_text(json.dumps(PARAMS))
    return load_params(p)


def test_null_params_stop_with_a_clear_message(tmp_path):
    p = tmp_path / "params.json"
    p.write_text(json.dumps({**PARAMS, "max_slope_deg": {"value": None}}))
    with pytest.raises(SystemExit, match="max_slope_deg"):
        load_params(p)


@pytest.mark.parametrize("deg", [5.0, 10.0, 20.0, 30.0])
def test_ramp_slope_matches_its_angle(deg):
    px = 1.0
    cols = np.arange(20) * px
    dem = np.tile(cols * math.tan(math.radians(deg)), (12, 1))  # rises east
    s = slope_horn(dem, px)
    assert s[1:-1, 1:-1] == pytest.approx(deg, abs=1e-6)
    # North-south ramp too (rows grow south).
    s2 = slope_horn(dem.T.copy(), px)
    assert s2[1:-1, 1:-1] == pytest.approx(deg, abs=1e-6)


def test_aggregate_takes_the_steepest_metre():
    a = np.array([[1, 2, 5, 5], [3, 4, 5, 9]], dtype="float64")
    assert aggregate_max(a, 2).tolist() == [[4, 9]]


def test_classes_follow_thresholds(model):
    s = np.array([0, 14.99, 15, 24.99, 25, 40, np.nan])
    assert classify(s, model).tolist() == [GO, GO, CAUTION, CAUTION, NOGO, NOGO, -1]


def test_cost_from_speed_curve_and_impassable_cells(model):
    s = np.array([0.0, 10.0, 20.0, 24.0, 25.0, np.nan])
    cls = classify(s, model)
    c = cost_min_per_m(s, cls, model)
    # factor: 1.0 at 0, 0.75 at 10 (linear to 0.5 at 20), 0.5 at 20, 0.4 at 24.
    assert c[:4] == pytest.approx([1 / 60, 1 / 45, 1 / 30, 1 / 24])
    assert np.isnan(c[4]) and np.isnan(c[5])  # no-go, nodata


def test_cost_on_ramp_end_to_end(model):
    deg = 10.0
    dem = np.tile(np.arange(40) * math.tan(math.radians(deg)), (40, 1))
    s = aggregate_max(slope_horn(dem, 1.0), 2)
    c = cost_min_per_m(s, classify(s, model), model)
    assert c[2:-2, 2:-2] == pytest.approx(1 / 45, rel=1e-6)


def test_pngs_use_exact_legend_colours_and_transparent_nodata(model):
    legend = [{"max_deg": 10, "color": "#1a9850"}, {"max_deg": 90, "color": "#a50026"}]
    rgba = colour_slope(np.array([[5.0, 10.0, 10.01, np.nan]]), legend)
    assert rgba[0].tolist() == [[26, 152, 80, 255], [26, 152, 80, 255], [165, 0, 38, 255], [0, 0, 0, 0]]
    tl = [{"class": "go", "color": "#1a9850"}, {"class": "caution", "color": "#fee08b"},
          {"class": "no-go", "color": "#a50026"}]
    rgba = colour_classes(np.array([[GO, CAUTION, NOGO, -1]], dtype="int8"), tl)
    assert rgba[0].tolist() == [[26, 152, 80, 255], [254, 224, 139, 255], [165, 0, 38, 255], [0, 0, 0, 0]]
    assert len({tuple(p) for p in rgba.reshape(-1, 4)}) == 4  # no blended colours

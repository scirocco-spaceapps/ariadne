import sys

import pytest

from aoi import CONTRACT_AOI, Frame, load_frame
from tracklib import clip_line, clip_segment, sol_range_report, track_collection, waypoint_collection

sys.path.insert(0, str(CONTRACT_AOI.parent))
import check  # noqa: E402  contracts/check.py: schema validator set up on contracts/openapi.yaml


@pytest.fixture(scope="module")
def frame() -> Frame:
    return load_frame()


def test_clip_segment_inside_crossing_and_outside():
    assert clip_segment((1, 1), (2, 2), 10, 10) == ((1, 1), (2, 2))
    assert clip_segment((-5, 5), (5, 5), 10, 10) == ((0, 5), (5, 5))
    assert clip_segment((-5, -5), (-1, -1), 10, 10) is None
    assert clip_segment((5, -5), (5, 15), 10, 10) == ((5, 0), (5, 10))


def test_clip_line_splits_where_it_leaves_and_reenters():
    pts = [(1, 1), (5, 1), (5, 20), (8, 20), (8, 5)]
    pieces = clip_line(pts, 10, 10)
    assert pieces == [[(1, 1), (5, 1), (5, 10)], [(8, 10), (8, 5)]]


def _mmgis(frame, xy_points, kind):
    """Build an MMGIS-like collection from AOI metres (inverse-projected to lon/lat)."""
    feats = []
    if kind == "line":
        coords = [list(frame.aoi_to_lonlat(x, y)) + [-2500.0] for x, y in xy_points]
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords},
                      "properties": {"sol": 1201}})
    else:
        for i, (x, y) in enumerate(xy_points):
            lon, lat = frame.aoi_to_lonlat(x, y)
            feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat, -2500.0]},
                          "properties": {"sol": 1200 + i, "site": 50, "drive": i, "lon": lon, "lat": lat}})
    return {"type": "FeatureCollection", "features": feats}


def test_track_and_waypoints_are_aoi_metres_and_match_the_contract(frame):
    trav = _mmgis(frame, [(100, 100), (900, 400), (3000, 400)], "line")
    wps = _mmgis(frame, [(100, 100), (900, 400), (3000, 400)], "point")
    track = track_collection(trav, frame)
    waypoints = waypoint_collection(wps, frame)

    before = len(check.errors)
    assert check.validate(track, "TrackCollection", "track")
    assert check.validate(waypoints, "WaypointCollection", "waypoints")
    assert len(check.errors) == before

    line = track["features"][0]["geometry"]["coordinates"]
    assert line[0] == pytest.approx([100, 100], abs=0.01)
    assert line[-1] == pytest.approx([2500, 400], abs=0.01)  # clipped at the east edge
    assert track["features"][0]["properties"] == {"sol": 1201}
    assert [f["properties"]["sol"] for f in waypoints["features"]] == [1200, 1201]  # 3rd is outside
    assert track["provenance"] == waypoints["provenance"] == "Observed"


def test_sol_range_report_lists_waypoints_outside(frame):
    wps = _mmgis(frame, [(10, 10), (10, -20)], "point")
    rep = sol_range_report(wps, frame, 1200, 1201)
    assert rep["count"] == 2
    assert [o["sol"] for o in rep["outside"]] == [1201]

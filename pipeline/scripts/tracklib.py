"""Rover traverse and waypoints: MMGIS JSON (lon/lat) -> GeoJSON in AOI metres.

Inputs are the Mars 2020 MMGIS layers M20_traverse.json (LineStrings with `sol`) and
M20_waypoints.json (Points with `sol`, `site`, `drive`, `lon`, `lat`). Outputs follow
TrackCollection and WaypointCollection in contracts/openapi.yaml.
"""

from __future__ import annotations

from typing import Iterable

from aoi import Frame

TRAVERSE_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json"
WAYPOINTS_URL = "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json"
SOURCE = "NASA/JPL-Caltech Mars 2020 MMGIS layers {name} ({url})"

XY = tuple[float, float]


def clip_segment(p: XY, q: XY, w: float, h: float) -> tuple[XY, XY] | None:
    """Liang-Barsky clip of segment p-q to the rectangle [0, w] x [0, h]."""
    (x0, y0), (x1, y1) = p, q
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for edge_p, edge_q in ((-dx, x0), (dx, w - x0), (-dy, y0), (dy, h - y0)):
        if edge_p == 0:
            if edge_q < 0:
                return None
            continue
        t = edge_q / edge_p
        if edge_p < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
        if t0 > t1:
            return None
    return (x0 + t0 * dx, y0 + t0 * dy), (x0 + t1 * dx, y0 + t1 * dy)


def clip_line(points: list[XY], w: float, h: float) -> list[list[XY]]:
    """Clip a polyline to the rectangle; returns the pieces that lie inside (each >= 2 points)."""
    pieces: list[list[XY]] = []
    cur: list[XY] = []
    for p, q in zip(points, points[1:]):
        seg = clip_segment(p, q, w, h)
        if seg is None:
            if len(cur) >= 2:
                pieces.append(cur)
            cur = []
            continue
        a, b = seg
        if cur and cur[-1] == a:
            cur.append(b)
        else:
            if len(cur) >= 2:
                pieces.append(cur)
            cur = [a, b]
        if b != q:  # left the rectangle
            pieces.append(cur)
            cur = []
    if len(cur) >= 2:
        pieces.append(cur)
    return pieces


def _r(v: float) -> float:
    return round(float(v), 2)


def track_collection(traverse: dict, frame: Frame) -> dict:
    w, h = frame.size_m
    features = []
    for f in traverse["features"]:
        coords = f["geometry"]["coordinates"]
        lon = [c[0] for c in coords]
        lat = [c[1] for c in coords]
        xs, ys = frame.lonlat_to_aoi(lon, lat)
        pts = [(float(x), float(y)) for x, y in zip(xs, ys)]
        for piece in clip_line(pts, w, h):
            if piece[0] == piece[-1] and len(set(piece)) == 1:
                continue  # zero-length drive segment
            props = {}
            if f["properties"].get("sol") is not None:
                props["sol"] = int(f["properties"]["sol"])
            features.append({
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[_r(x), _r(y)] for x, y in piece]},
                "properties": props,
            })
    return {
        "type": "FeatureCollection",
        "provenance": "Observed",
        "source": SOURCE.format(name="M20_traverse.json", url=TRAVERSE_URL)
        + "; converted to AOI metres by pipeline/scripts/02_track.py",
        "features": features,
    }


def waypoint_collection(waypoints: dict, frame: Frame) -> dict:
    features = []
    for f in waypoints["features"]:
        p = f["properties"]
        if p.get("sol") is None:
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        x, y = frame.lonlat_to_aoi(lon, lat)
        if not frame.inside(x, y):
            continue
        props = {"sol": int(p["sol"])}
        for key in ("site", "drive"):
            if p.get(key) is not None:
                props[key] = int(p[key])
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [_r(x), _r(y)]},
            "properties": props,
        })
    return {
        "type": "FeatureCollection",
        "provenance": "Observed",
        "source": SOURCE.format(name="M20_waypoints.json", url=WAYPOINTS_URL)
        + "; converted to AOI metres by pipeline/scripts/02_track.py",
        "features": features,
    }


def sol_range_report(waypoints: dict, frame: Frame, sol_min: int, sol_max: int) -> dict:
    """Where the waypoints of a sol range fall relative to the AOI (AOI metres)."""
    xs, ys, outside = [], [], []
    for f in waypoints["features"]:
        sol = f["properties"].get("sol")
        if sol is None or not (sol_min <= int(sol) <= sol_max):
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        x, y = frame.lonlat_to_aoi(lon, lat)
        xs.append(float(x))
        ys.append(float(y))
        if not frame.inside(x, y):
            outside.append({"sol": int(sol), "xy": [_r(x), _r(y)]})
    return {
        "count": len(xs),
        "x_range": [_r(min(xs)), _r(max(xs))] if xs else None,
        "y_range": [_r(min(ys)), _r(max(ys))] if ys else None,
        "outside": outside,
    }


def iter_xy(collection: dict) -> Iterable[XY]:
    for f in collection["features"]:
        g = f["geometry"]
        if g["type"] == "Point":
            yield tuple(g["coordinates"])
        else:
            yield from (tuple(c) for c in g["coordinates"])

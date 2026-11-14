"""Task B4: sanity checks of the slope raster and the planned route against Perseverance's real drive.

A rover is not a human: these are checks that the DEM-derived slopes and our thresholds behave
sensibly on ground a vehicle actually crossed, not proof that a suited astronaut can walk it.

1. Slope along the track: sample slope_2m.f32 every 0.5 m along the rover track inside the AOI and
   weight by path length. Report the distribution and the share in the go / caution / no-go classes.
2. Planned route vs rover path between two stops: the planner's own least-cost leg (planner/app) vs
   the rover's track between the same two waypoints. Length ratio, time under our model for both,
   and where the planned path runs more than DIVERGE_M from the rover's.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

STEP_M = 0.5
DIVERGE_M = 25.0


def load_f32(path: Path, px_m: float, size_m: tuple[float, float]) -> np.ndarray:
    w, h = int(round(size_m[0] / px_m)), int(round(size_m[1] / px_m))
    return np.fromfile(path, dtype="<f4").reshape(h, w)


def lookup(raster: np.ndarray, px_m: float, size_y: float, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Nearest-cell values at AOI points; NaN outside the raster."""
    r = np.floor((size_y - y) / px_m).astype(int)
    c = np.floor(x / px_m).astype(int)
    ok = (r >= 0) & (r < raster.shape[0]) & (c >= 0) & (c < raster.shape[1])
    out = np.full(x.shape, np.nan, "float64")
    out[ok] = raster[r[ok], c[ok]]
    return out


def densify(line: np.ndarray, step: float = STEP_M) -> tuple[np.ndarray, np.ndarray]:
    """Midpoints of sub-steps of at most `step` metres along a polyline, and the length each stands for."""
    pts, lens = [], []
    for (x0, y0), (x1, y1) in zip(line[:-1], line[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L == 0:
            continue
        n = max(1, math.ceil(L / step))
        t = (np.arange(n) + 0.5) / n
        pts.append(np.column_stack([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]))
        lens.append(np.full(n, L / n))
    if not pts:
        return np.zeros((0, 2)), np.zeros(0)
    return np.vstack(pts), np.concatenate(lens)


def sample_lines(lines: list[np.ndarray], raster: np.ndarray, px_m: float, size_m: tuple[float, float]):
    """Values and path lengths along all lines, only where the raster has a value."""
    vals, lens = [], []
    for line in lines:
        p, l = densify(line)
        v = lookup(raster, px_m, size_m[1], p[:, 0], p[:, 1]) if len(p) else np.zeros(0)
        keep = np.isfinite(v)
        vals.append(v[keep])
        lens.append(l[keep])
    return np.concatenate(vals) if vals else np.zeros(0), np.concatenate(lens) if lens else np.zeros(0)


def weighted_quantile(v: np.ndarray, w: np.ndarray, q: float) -> float:
    i = np.argsort(v)
    cw = np.cumsum(w[i])
    return float(v[i][np.searchsorted(cw, q * cw[-1])])


def slope_stats(slope: np.ndarray, length: np.ndarray, caution: float, nogo: float) -> dict:
    total = float(length.sum())
    return {
        "length_m": round(total, 1),
        "median_deg": round(weighted_quantile(slope, length, 0.5), 2),
        "p95_deg": round(weighted_quantile(slope, length, 0.95), 2),
        "max_deg": round(float(slope.max()), 2),
        "go_share": round(float(length[slope < caution].sum() / total), 4),
        "caution_share": round(float(length[(slope >= caution) & (slope <= nogo)].sum() / total), 4),
        "nogo_share": round(float(length[slope > nogo].sum() / total), 4),
    }


def track_lines(track_fc: dict, sols: tuple[int, int] | None = None) -> list[np.ndarray]:
    """LineStrings of the track, optionally only drives with sol in (sols[0], sols[1]], in sol order."""
    feats = sorted(track_fc["features"], key=lambda f: f["properties"].get("sol", 0))
    out = []
    for f in feats:
        s = f["properties"].get("sol")
        if sols and not (sols[0] < s <= sols[1]):
            continue
        g = f["geometry"]
        parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        out += [np.asarray(p, "float64")[:, :2] for p in parts if len(p) >= 2]
    return out


def chain(lines: list[np.ndarray]) -> np.ndarray:
    return np.vstack(lines) if lines else np.zeros((0, 2))


def length_m(p: np.ndarray) -> float:
    return float(np.hypot(*np.diff(p, axis=0).T).sum()) if len(p) > 1 else 0.0


def time_along(p: np.ndarray, cost: np.ndarray, px_m: float, size_m: tuple[float, float]) -> tuple[float, float]:
    """Walking time (min) along a path on the cost grid and the share of its length on no-go cells."""
    q, l = densify(p)
    c = lookup(cost, px_m, size_m[1], q[:, 0], q[:, 1])
    bad = ~np.isfinite(c) | (c <= 0)
    t = float((c[~bad] * l[~bad]).sum())
    return t, float(l[bad].sum() / l.sum()) if l.sum() else 0.0


def distance_to_path(points: np.ndarray, path: np.ndarray) -> np.ndarray:
    """Distance from each point to the nearest point of a densified path."""
    d, _ = densify(path, 1.0)
    out = np.empty(len(points))
    for i, (x, y) in enumerate(points):
        out[i] = np.hypot(d[:, 0] - x, d[:, 1] - y).min()
    return out


def divergences(planned: np.ndarray, rover: np.ndarray, limit: float = DIVERGE_M) -> list[dict]:
    """Stretches of the planned path farther than `limit` from the rover's path."""
    p, l = densify(planned, 2.0)
    d = distance_to_path(p, rover)
    off = d > limit
    out, i = [], 0
    while i < len(p):
        if off[i]:
            j = i
            while j + 1 < len(p) and off[j + 1]:
                j += 1
            out.append({"from_xy": [round(float(p[i, 0]), 1), round(float(p[i, 1]), 1)],
                        "to_xy": [round(float(p[j, 0]), 1), round(float(p[j, 1]), 1)],
                        "length_m": round(float(l[i:j + 1].sum()), 1), "max_off_m": round(float(d[i:j + 1].max()), 1)})
            i = j + 1
        else:
            i += 1
    return out


def load_json(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))

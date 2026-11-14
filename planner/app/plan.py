"""Planner data (loaded once) and the /route and /abort computations.

Files, all from DATA_DIR + aoi.assets_base (root CLAUDE.md):
- aoi.json         from AOI_PATH, default DATA_DIR/aoi.json (a copy of contracts/aoi.json, or the
                   fixture aoi.json when DATA_DIR is contracts/fixtures)
- cost_2m.f32      required, minutes per metre, NaN = impassable (pipeline 04_cost.py, outside the contract)
- dem_4m.f32       required (rasters.dem), for climb
- slope_2m.f32     optional (rasters.slope_values), for max slope; else slope from the DEM along the path
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from .grid import Grid, read_f32
from .routing import HomeField, least_cost_path, mcp_costs, path_length_m, simplify

COST_FILE = "cost_2m.f32"
COST_PX_M = 2.0


class PlanError(Exception):
    """A request the planner cannot answer; served as 422 {detail}."""


@dataclass
class Place:
    id: str
    name: str
    xy: tuple[float, float]


@dataclass
class PlannerData:
    aoi: dict
    cost: Grid
    costs: np.ndarray
    dem: Grid
    slope: Grid | None
    haven: Place
    stops: dict[str, Place]
    home: HomeField
    dwell_min: float
    files: list[str] = field(default_factory=list)


def data_paths() -> tuple[Path, Path]:
    data_dir = Path(os.environ.get("DATA_DIR", "/srv/assets")).expanduser()
    aoi_path = Path(os.environ.get("AOI_PATH") or data_dir / "aoi.json").expanduser()
    return data_dir, aoi_path


def load(data_dir: Path, aoi_path: Path) -> PlannerData:
    if not aoi_path.exists():
        raise FileNotFoundError(f"aoi.json not found at {aoi_path} (set AOI_PATH or DATA_DIR)")
    aoi = json.loads(aoi_path.read_text(encoding="utf-8"))
    size = (float(aoi["size_m"][0]), float(aoi["size_m"][1]))
    base = data_dir / aoi["assets_base"]
    rasters = aoi["rasters"]

    def need(name: str) -> Path:
        p = base / name
        if not p.exists():
            raise FileNotFoundError(f"{name} not found in {base}")
        return p

    cost = read_f32(need(COST_FILE), COST_PX_M, size)
    dem = read_f32(need(rasters["dem"]["file"]), float(rasters["dem"]["px_m"]), size)
    slope = None
    sv = rasters.get("slope_values")
    if sv and (base / sv["file"]).exists():
        slope = read_f32(base / sv["file"], float(sv["px_m"]), size)

    sh = aoi["safe_haven"]
    haven = Place(sh["id"], sh["name"], (float(sh["xy"][0]), float(sh["xy"][1])))
    stops = {s["id"]: Place(s["id"], s["name"], (float(s["xy"][0]), float(s["xy"][1]))) for s in aoi["stops"]}
    costs = mcp_costs(cost)
    hcell = cost.cell(*haven.xy)
    if hcell is None or not np.isfinite(costs[hcell]):
        raise ValueError(f"safe haven {haven.id} at {list(haven.xy)} is outside the AOI or on an impassable cell")
    home = HomeField(costs, cost.px_m, hcell)
    return PlannerData(aoi=aoi, cost=cost, costs=costs, dem=dem, slope=slope, haven=haven, stops=stops,
                       home=home, dwell_min=float(aoi["model"]["dwell_min"]),
                       files=[COST_FILE, rasters["dem"]["file"]] + ([sv["file"]] if slope is not None else []))


def _r(v: float) -> float:
    return round(float(v), 2)


def _points(d: PlannerData, cells: list[tuple[int, int]], a: tuple[float, float], b: tuple[float, float]) -> np.ndarray:
    """Cell centres of a path with the exact endpoints; at least two points."""
    pts = np.array([d.cost.centre(r, c) for r, c in cells], dtype="float64").reshape(-1, 2)
    if len(pts) < 2:
        pts = np.array([a, b], dtype="float64")
    pts[0], pts[-1] = a, b
    return pts


def _climb_and_max_slope(d: PlannerData, pts: np.ndarray, cells: list[tuple[int, int]]) -> tuple[float, float]:
    z = d.dem.bilinear(pts[:, 0], pts[:, 1])
    dz = np.diff(z)
    climb = float(np.nansum(np.clip(dz, 0, None)))
    if d.slope is not None:
        rc = np.array([d.slope.cell(*p) for p in pts])
        s = d.slope.values[rc[:, 0], rc[:, 1]]
        max_slope = float(np.nanmax(s)) if np.isfinite(s).any() else 0.0
    else:
        ds = np.hypot(*np.diff(pts, axis=0).T)
        with np.errstate(divide="ignore", invalid="ignore"):
            ang = np.degrees(np.arctan(np.abs(dz) / ds))
        ang = ang[np.isfinite(ang)]
        max_slope = float(ang.max()) if ang.size else 0.0
    return climb, min(max(max_slope, 0.0), 90.0)


def _leg(d: PlannerData, a: Place, b: Place) -> dict:
    ca, cb = d.cost.cell(*a.xy), d.cost.cell(*b.xy)
    if ca is None or cb is None:
        raise PlanError(f"{a.id if ca is None else b.id} is outside the AOI")
    res = least_cost_path(d.costs, d.cost.px_m, ca, cb)
    if res is None:
        raise PlanError(f"no passable path from {a.id} to {b.id}")
    pts = _points(d, res.cells, a.xy, b.xy)
    climb, max_slope = _climb_and_max_slope(d, pts, res.cells)
    path = simplify(pts, d.cost.px_m)
    return {
        "from": a.id,
        "to": b.id,
        "path": [[_r(x), _r(y)] for x, y in path],
        "distance_m": _r(path_length_m(pts)),
        "time_min": _r(res.time_min),
        "climb_m": _r(climb),
        "max_slope_deg": _r(max_slope),
    }


def plan_route(d: PlannerData, stop_ids: list[str], return_home: bool) -> dict:
    unknown = [s for s in stop_ids if s not in d.stops]
    if unknown:
        raise PlanError(f"unknown stop id(s): {', '.join(unknown)}; known: {', '.join(d.stops)}")
    seq = [d.haven] + [d.stops[s] for s in stop_ids] + ([d.haven] if return_home else [])
    legs, timeline = [], []
    t = 0.0
    walk = dwell = 0.0
    for i, (a, b) in enumerate(zip(seq, seq[1:])):
        leg = _leg(d, a, b)
        legs.append(leg)
        timeline.append({"kind": "walk", "leg": i, "t0_min": _r(t), "t1_min": _r(t + leg["time_min"])})
        t += leg["time_min"]
        walk += leg["time_min"]
        if b.id != d.haven.id:
            timeline.append({"kind": "dwell", "stop": b.id, "t0_min": _r(t), "t1_min": _r(t + d.dwell_min)})
            t += d.dwell_min
            dwell += d.dwell_min
    return {
        "legs": legs,
        "timeline": timeline,
        "totals": {
            "distance_m": _r(sum(leg["distance_m"] for leg in legs)),
            "walk_min": _r(walk),
            "dwell_min": _r(dwell),
            "eva_min": _r(walk + dwell),
        },
        "provenance": "Modeled",
    }


def plan_abort(d: PlannerData, xy: tuple[float, float]) -> dict:
    x, y = xy
    if not (np.isfinite(x) and np.isfinite(y)):
        raise PlanError("position must be finite numbers")
    cell = d.cost.cell(x, y)
    if cell is None:
        w, h = d.cost.size_m
        raise PlanError(f"position [{x}, {y}] is outside the AOI (0..{w:g}, 0..{h:g} m)")
    res = d.home.path_home(cell)
    if res is None:
        raise PlanError(f"no passable path from [{x}, {y}] to the safe haven")
    pts = _points(d, res.cells, (float(x), float(y)), d.haven.xy)
    path = simplify(pts, d.cost.px_m)
    return {
        "path": [[_r(px), _r(py)] for px, py in path],
        "time_min": _r(res.time_min),
        "distance_m": _r(path_length_m(pts)),
        "provenance": "Modeled",
    }

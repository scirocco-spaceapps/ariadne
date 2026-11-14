"""Task B3: places Perseverance saw but never visited ("seen, not touched").

Steps (the notebook viewshed.ipynb runs them and draws the figures):
  1. For every rover waypoint inside the AOI, a viewshed on the 1 m DEM with gdal_viewshed:
     observer at observer_height_m (model/params.json) above the ground, target on the ground,
     max distance 600 m, curvature coefficient 1.0 (Mars sphere from the DEM's CRS, no refraction).
  2. times_seen = sum of the viewsheds; closest_view = distance to the nearest waypoint that saw
     each cell.
  3. touched = cells within 10 m of the rover track.
  4. seen_not_touched (2 m) = 2 x 2 blocks where at least 2 of the 4 one-metre cells were seen from
     within 150 m (CLOSE_M) and are not touched. 150 m: Mastcam-Z resolves about 3.3 cm at 100 m
     (Bell et al. 2021), about 5 cm at 150 m, so the rover may hold a useful photo.
  5. The layer is cut into 50 x 50 m tiles (TILE_M); a tile with at least 100 m2 of the layer is a
     candidate target. Its point is the centroid of the layer cells inside it; properties: area,
     distance to the nearest waypoint and that waypoint's sol; ranked by how many waypoints saw it.
  CLOSE_M and TILE_M are our choices (Assumed); everything else follows the task card.

Coordinates: the DEM is in the projected CRS of contracts/aoi.json (crs.proj4); AOI metres are
projected minus the projected AOI origin (root CLAUDE.md). GeoJSON inputs are already AOI metres.
"""

from __future__ import annotations

import csv
import json
import math
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from scipy import ndimage

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "notebooks" / "out"
MARS_LONLAT = "+proj=longlat +R=3396190 +no_defs"
MAX_DISTANCE_M = 600.0
TOUCH_RADIUS_M = 10.0
MIN_AREA_M2 = 100.0
CLOSE_M = 150.0   # Assumed: seen from close enough for a useful Mastcam-Z photo
TILE_M = 50.0     # Assumed: target tile size


# ---------------------------------------------------------------- frame and inputs

def load_aoi(path: Path = REPO / "contracts" / "aoi.json") -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def projected_origin(aoi: dict) -> tuple[float, float]:
    """Projected coordinates of the AOI south-west corner."""
    fwd = Transformer.from_crs(CRS.from_proj4(MARS_LONLAT), CRS.from_proj4(aoi["crs"]["proj4"]), always_xy=True)
    x, y = fwd.transform(*aoi["origin_lonlat"])
    return float(x), float(y)


def lonlat_to_aoi(aoi: dict, lon, lat):
    fwd = Transformer.from_crs(CRS.from_proj4(MARS_LONLAT), CRS.from_proj4(aoi["crs"]["proj4"]), always_xy=True)
    x, y = fwd.transform(np.asarray(lon, "float64"), np.asarray(lat, "float64"))
    x0, y0 = projected_origin(aoi)
    return x - x0, y - y0


def observer_height(params: Path = REPO / "model" / "params.json") -> float:
    return float(json.loads(Path(params).read_text(encoding="utf-8"))["observer_height_m"]["value"])


@dataclass
class Grid:
    """A north-up raster in projected metres, with the AOI origin to convert to AOI metres."""

    z: np.ndarray            # elevation, NaN = no data
    px: float                # pixel size, metres
    west: float              # projected x of the left edge of column 0
    north: float             # projected y of the top edge of row 0
    origin: tuple[float, float]  # projected AOI south-west corner
    path: Path               # the GeoTIFF gdal_viewshed reads

    @property
    def shape(self) -> tuple[int, int]:
        return self.z.shape

    def aoi_to_rc(self, x: float, y: float) -> tuple[int, int]:
        px_, py_ = x + self.origin[0], y + self.origin[1]
        return int(math.floor((self.north - py_) / self.px)), int(math.floor((px_ - self.west) / self.px))

    def rc_to_aoi(self, r: float, c: float) -> tuple[float, float]:
        """AOI metres of a (fractional) pixel centre."""
        return self.west + (c + 0.5) * self.px - self.origin[0], self.north - (r + 0.5) * self.px - self.origin[1]

    def inside(self, r: int, c: int) -> bool:
        return 0 <= r < self.shape[0] and 0 <= c < self.shape[1]


def read_dem(path: Path, origin: tuple[float, float]) -> Grid:
    with rasterio.open(path) as ds:
        z = ds.read(1).astype("float32")
        if ds.nodata is not None:
            z[z == ds.nodata] = np.nan
        t = ds.transform
        if abs(t.b) > 1e-9 or abs(t.d) > 1e-9 or abs(abs(t.a) - abs(t.e)) > 1e-9 or t.e > 0:
            raise ValueError(f"{path}: expected a north-up raster with square pixels")
        return Grid(z=z, px=float(t.a), west=float(t.c), north=float(t.f), origin=origin, path=Path(path))


def read_points(path: Path) -> list[dict]:
    """Waypoints FeatureCollection in AOI metres -> [{x, y, sol, ...}]."""
    fc = json.loads(Path(path).read_text(encoding="utf-8"))
    out = []
    for f in fc["features"]:
        x, y = f["geometry"]["coordinates"][:2]
        out.append({"x": float(x), "y": float(y), **f.get("properties", {})})
    return out


def read_lines(path: Path) -> list[np.ndarray]:
    """Track FeatureCollection in AOI metres -> list of (n, 2) arrays."""
    fc = json.loads(Path(path).read_text(encoding="utf-8"))
    lines = []
    for f in fc["features"]:
        g = f["geometry"]
        parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        lines += [np.asarray(p, "float64")[:, :2] for p in parts if len(p) >= 2]
    return lines


def waypoints_from_m20(m20_path: Path, aoi: dict, sols: tuple[int, int] | None = None) -> list[dict]:
    """Fallback when waypoints.geojson is not at hand: M20_waypoints.json (lon/lat) -> AOI metres."""
    feats = json.loads(Path(m20_path).read_text(encoding="utf-8"))["features"]
    props = [f["properties"] for f in feats if sols is None or sols[0] <= f["properties"]["sol"] <= sols[1]]
    x, y = lonlat_to_aoi(aoi, [p["lon"] for p in props], [p["lat"] for p in props])
    return [{"x": float(a), "y": float(b), "sol": p["sol"], "rmc": p.get("RMC")} for a, b, p in zip(x, y, props)]


# ---------------------------------------------------------------- viewsheds

def viewshed(grid: Grid, x: float, y: float, height: float, workdir: Path, max_distance: float = MAX_DISTANCE_M):
    """gdal_viewshed for an observer at AOI (x, y). Returns (visible bool window, row_off, col_off)."""
    out = Path(workdir) / "vs.tif"
    cmd = ["gdal_viewshed", "-q", "-oz", f"{height}", "-tz", "0", "-md", f"{max_distance}",
           "-vv", "1", "-iv", "0", "-ov", "0", "-cc", "1.0",
           "-ox", f"{x + grid.origin[0]}", "-oy", f"{y + grid.origin[1]}", str(grid.path), str(out)]
    subprocess.run(cmd, check=True, capture_output=True)
    with rasterio.open(out) as ds:
        vis = ds.read(1) == 1
        t = ds.transform
    row_off = int(round((grid.north - t.f) / grid.px))
    col_off = int(round((t.c - grid.west) / grid.px))
    return vis, row_off, col_off


def paste(full: np.ndarray, win: np.ndarray, row_off: int, col_off: int) -> None:
    """Add a window into a full-size array, clipped to the full array."""
    r0, c0 = max(row_off, 0), max(col_off, 0)
    r1 = min(row_off + win.shape[0], full.shape[0])
    c1 = min(col_off + win.shape[1], full.shape[1])
    if r1 > r0 and c1 > c0:
        full[r0:r1, c0:c1] += win[r0 - row_off:r1 - row_off, c0 - col_off:c1 - col_off]


def times_seen(grid: Grid, waypoints: list[dict], height: float):
    """Sum of the viewsheds of the waypoints that lie on the DEM.

    Returns (count, closest_view, used waypoints, windows); closest_view is the distance in metres to
    the nearest waypoint that saw the cell (inf if never seen)."""
    count = np.zeros(grid.shape, "int32")
    closest = np.full(grid.shape, np.inf, "float32")
    used, windows = [], []
    with tempfile.TemporaryDirectory() as tmp:
        for w in waypoints:
            r, c = grid.aoi_to_rc(w["x"], w["y"])
            if not grid.inside(r, c) or not np.isfinite(grid.z[r, c]):
                continue
            win, ro, co = viewshed(grid, w["x"], w["y"], height, Path(tmp))
            paste(count, win.astype("int32"), ro, co)
            _closest_into(closest, grid, win, ro, co, w["x"], w["y"])
            used.append(w)
            windows.append((win, ro, co))
    return count, closest, used, windows


def _closest_into(closest: np.ndarray, grid: Grid, win: np.ndarray, ro: int, co: int, x: float, y: float) -> None:
    r0, c0 = max(ro, 0), max(co, 0)
    r1, c1 = min(ro + win.shape[0], closest.shape[0]), min(co + win.shape[1], closest.shape[1])
    if r1 <= r0 or c1 <= c0:
        return
    rr, cc = np.mgrid[r0:r1, c0:c1]
    cx, cy = grid.rc_to_aoi(rr, cc)
    d = np.hypot(cx - x, cy - y).astype("float32")
    vis = win[r0 - ro:r1 - ro, c0 - co:c1 - co]
    sub = closest[r0:r1, c0:c1]
    np.minimum(sub, np.where(vis, d, np.inf).astype("float32"), out=sub)


# ---------------------------------------------------------------- touched, resample, regions

def touched_mask(grid: Grid, lines: list[np.ndarray], radius: float = TOUCH_RADIUS_M) -> np.ndarray:
    """Cells whose centre is within `radius` metres of the track."""
    on_track = np.zeros(grid.shape, bool)
    step = grid.px / 2
    for line in lines:
        for (x0, y0), (x1, y1) in zip(line[:-1], line[1:]):
            n = max(1, int(math.ceil(math.hypot(x1 - x0, y1 - y0) / step)))
            for k in range(n + 1):
                r, c = grid.aoi_to_rc(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)
                if grid.inside(r, c):
                    on_track[r, c] = True
    if not on_track.any():
        return on_track
    dist = ndimage.distance_transform_edt(~on_track) * grid.px
    return dist <= radius


def block_majority(mask: np.ndarray, factor: int = 2) -> np.ndarray:
    """factor x factor blocks that are True in at least half of their cells (edges trimmed)."""
    h, w = (mask.shape[0] // factor) * factor, (mask.shape[1] // factor) * factor
    blocks = mask[:h, :w].reshape(h // factor, factor, w // factor, factor)
    return blocks.mean(axis=(1, 3)) >= 0.5


# ---------------------------------------------------------------- the whole B3 step

@dataclass
class Result:
    count: np.ndarray        # 1 m times seen
    closest: np.ndarray      # 1 m distance to the nearest waypoint that saw the cell
    touched: np.ndarray      # 1 m
    snt2: np.ndarray         # 2 m seen-from-close, not touched
    tiles2: np.ndarray       # 2 m tile index of every cell (row-major tile number + 1)
    targets: list[dict]      # id, x, y, area_m2, distance_m, sol, n_views, tile
    seen_from: list[dict]    # target id, sol, rmc, distance_m
    used: list[dict]         # waypoints with a viewshed


def _rmc(w: dict) -> str | None:
    """Rover site_drive id (as in M20_waypoints.json RMC) from rmc, RMC or site and drive."""
    if w.get("rmc") or w.get("RMC"):
        return w.get("rmc") or w.get("RMC")
    if w.get("site") is not None and w.get("drive") is not None:
        return f'{w["site"]}_{w["drive"]}'
    return None


def tile_index(shape: tuple[int, int], px: float, tile_m: float = TILE_M) -> np.ndarray:
    """Tile number (1-based, row-major) of every cell of a grid with pixel size px."""
    k = max(1, int(round(tile_m / px)))
    rows = np.arange(shape[0]) // k
    cols = np.arange(shape[1]) // k
    ncols = int(cols.max()) + 1
    return (rows[:, None] * ncols + cols[None, :] + 1).astype("int32")


def seen_not_touched(grid: Grid, waypoints: list[dict], track: list[np.ndarray], height: float,
                     close_m: float = CLOSE_M, tile_m: float = TILE_M) -> Result:
    count, closest, used, windows = times_seen(grid, waypoints, height)
    touched = touched_mask(grid, track)
    snt1 = (closest <= close_m) & ~touched & np.isfinite(grid.z)
    snt2 = block_majority(snt1, 2)
    px2 = grid.px * 2
    tiles2 = tile_index(snt2.shape, px2, tile_m)

    ids = np.unique(tiles2[snt2])
    area = ndimage.sum(snt2, tiles2, ids) * px2 * px2
    cents = ndimage.center_of_mass(snt2, tiles2, ids)
    big1 = np.kron(tiles2, np.ones((2, 2), tiles2.dtype))[: grid.shape[0], : grid.shape[1]]
    wp_xy = np.array([[w["x"], w["y"]] for w in used]) if used else np.zeros((0, 2))

    # how many waypoints saw each tile's layer cells
    layer1 = np.kron(snt2, np.ones((2, 2), bool))[: grid.shape[0], : grid.shape[1]]
    views: dict[int, list[tuple[dict, float]]] = {}
    for w, (win, ro, co) in zip(used, windows):
        r0, c0 = max(ro, 0), max(co, 0)
        r1, c1 = min(ro + win.shape[0], big1.shape[0]), min(co + win.shape[1], big1.shape[1])
        if r1 <= r0 or c1 <= c0:
            continue
        sel = win[r0 - ro:r1 - ro, c0 - co:c1 - co] & layer1[r0:r1, c0:c1]
        for tid in np.unique(big1[r0:r1, c0:c1][sel]):
            views.setdefault(int(tid), []).append(w)

    cand = []
    for tid, a, (r, c) in zip(ids, area, cents):
        if a < MIN_AREA_M2:
            continue
        x, y = grid.rc_to_aoi(2 * r + 0.5, 2 * c + 0.5)
        if len(wp_xy):
            d = np.hypot(wp_xy[:, 0] - x, wp_xy[:, 1] - y)
            j = int(d.argmin())
            dist, sol = float(d[j]), used[j].get("sol")
        else:
            dist, sol = float("nan"), None
        cand.append({"tile": int(tid), "x": round(x, 1), "y": round(y, 1), "area_m2": round(float(a), 1),
                     "distance_m": round(dist, 1), "sol": sol, "n_views": len(views.get(int(tid), []))})
    cand.sort(key=lambda t: (-t["n_views"], t["distance_m"], -t["area_m2"]))
    for i, t in enumerate(cand, start=1):
        t["id"] = f"t{i}"

    seen_from = []
    for t in cand:
        for w in views.get(t["tile"], []):
            seen_from.append({"target": t["id"], "sol": w.get("sol"), "rmc": _rmc(w),
                              "distance_m": round(math.hypot(t["x"] - w["x"], t["y"] - w["y"]), 1)})
    return Result(count, closest, touched, snt2, tiles2, cand, seen_from, used)


def choose(res: Result, picks: dict[str, tuple[float, float]], tol_m: float = 30.0) -> Result:
    """Keep only the chosen targets, renamed to stable ids.

    picks maps a stable id to the (x, y) of the chosen candidate; the candidate whose point is
    nearest (within tol_m) gets that id. Matching by position keeps ids stable when the ranking
    changes on a re-run. Raises if a pick has no candidate nearby.
    """
    chosen, rename = [], {}
    for new_id, (x, y) in picks.items():
        best = min(res.targets, key=lambda t: math.hypot(t["x"] - x, t["y"] - y), default=None)
        if best is None or math.hypot(best["x"] - x, best["y"] - y) > tol_m:
            raise ValueError(f"no candidate within {tol_m} m of {new_id} at ({x}, {y})")
        rename[best["id"]] = new_id
        chosen.append({**best, "candidate_id": best["id"], "id": new_id})
    seen = [{**s, "target": rename[s["target"]]} for s in res.seen_from if s["target"] in rename]
    return Result(res.count, res.closest, res.touched, res.snt2, res.tiles2, chosen, seen, res.used)


def reachable(targets: list[dict], cost_to_home: np.ndarray | None, px: float, size_y: float) -> list[dict]:
    """Add cost_to_home_min (None if unknown, NaN if unreachable) from the 2 m cost_to_home raster."""
    for t in targets:
        if cost_to_home is None:
            t["cost_to_home_min"] = None
            continue
        r = int((size_y - t["y"]) // px)
        c = int(t["x"] // px)
        ok = 0 <= r < cost_to_home.shape[0] and 0 <= c < cost_to_home.shape[1]
        t["cost_to_home_min"] = float(cost_to_home[r, c]) if ok else float("nan")
    return targets


# ---------------------------------------------------------------- outputs

def write_candidates(res: Result, out: Path = OUT) -> None:
    """All ranked candidate tiles, for the record and for adding targets later."""
    out.mkdir(parents=True, exist_ok=True)
    keys = ["id", "x", "y", "area_m2", "distance_m", "sol", "n_views", "cost_to_home_min"]
    with (out / "target_candidates.csv").open("w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        wr.writeheader()
        wr.writerows(res.targets)


def write_outputs(res: Result, out: Path = OUT, source: str = "", synthetic: bool = False) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    fc = {
        "type": "FeatureCollection",
        "provenance": "Simulation" if synthetic else "Derived",
        "source": ("SYNTHETIC test data. " if synthetic else "") + source,
        "features": [
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [t["x"], t["y"]]},
             "properties": {"id": t["id"], "area_m2": t["area_m2"], "distance_m": t["distance_m"], "sol": t["sol"]}}
            for t in res.targets
        ],
    }
    (out / "targets.geojson").write_text(json.dumps(fc, indent=1) + "\n", encoding="utf-8")
    with (out / "targets_seen_from.csv").open("w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=["target", "sol", "rmc", "distance_m"])
        wr.writeheader()
        wr.writerows(sorted(res.seen_from, key=lambda s: (s["target"], s["distance_m"])))
    rgba = np.zeros(res.snt2.shape + (4,), "uint8")
    rgba[res.snt2] = (255, 140, 0, 200)
    import matplotlib.pyplot as plt
    plt.imsave(out / "seen_not_touched_2m.png", rgba)
    return fc

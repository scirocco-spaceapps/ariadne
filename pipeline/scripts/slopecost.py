"""Slope, traversability and walking cost from the DEM and model/params.json (task A3).

- Slope: Horn's 3 x 3 method on the 1 m DEM, degrees.
- 2 m aggregation: the MAXIMUM of the four 1 m slopes. Conservative on purpose: a 2 m cell is as
  steep as its steepest metre, so averaging never hides a steep step from the caution / no-go classes.
- Classes (same rule as contracts/tools/make_fixtures.py): go if slope < caution_slope_deg,
  caution if caution_slope_deg <= slope < max_slope_deg, no-go if slope >= max_slope_deg.
- Cost: minutes per metre = 1 / (walk_speed_flat_m_per_min * factor(slope)), factor linearly
  interpolated in speed_vs_slope ([slope_deg, factor] pairs, clamped at the ends).
  No-go cells, NaN cells and factor <= 0 are impassable (NaN).
- Every threshold comes from the params file; nothing is hard-coded.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from aoi import REPO

PARAMS_FILE = REPO / "model" / "params.json"
REQUIRED = ("max_slope_deg", "caution_slope_deg", "walk_speed_flat_m_per_min", "speed_vs_slope")

GO, CAUTION, NOGO = 0, 1, 2
CLASS_NAMES = {GO: "go", CAUTION: "caution", NOGO: "no-go"}


@dataclass(frozen=True)
class WalkModel:
    max_slope_deg: float
    caution_slope_deg: float
    walk_speed_flat_m_per_min: float
    speed_vs_slope: np.ndarray  # (n, 2) ascending slope
    provenance: dict[str, str]
    source_file: str


def load_params(path: Path = PARAMS_FILE) -> WalkModel:
    p = json.loads(Path(path).read_text(encoding="utf-8"))
    missing = [k for k in REQUIRED if not isinstance(p.get(k), dict) or p[k].get("value") is None]
    if missing:
        raise SystemExit(
            f"{path}: no value yet for {', '.join(missing)} (task B1, Bunyamin). "
            "For a local dev run pass --params <file> with Assumed values; never publish those as real."
        )
    pairs = np.asarray(p["speed_vs_slope"]["value"], dtype="float64")
    if pairs.ndim != 2 or pairs.shape[1] != 2 or len(pairs) < 1 or np.any(np.diff(pairs[:, 0]) <= 0):
        raise SystemExit(f"{path}: speed_vs_slope must be [[slope_deg, factor], ...] with ascending slope")
    m = WalkModel(
        max_slope_deg=float(p["max_slope_deg"]["value"]),
        caution_slope_deg=float(p["caution_slope_deg"]["value"]),
        walk_speed_flat_m_per_min=float(p["walk_speed_flat_m_per_min"]["value"]),
        speed_vs_slope=pairs,
        provenance={k: str(p[k].get("provenance")) for k in REQUIRED},
        source_file=str(path),
    )
    if not (0 < m.caution_slope_deg <= m.max_slope_deg <= 90) or m.walk_speed_flat_m_per_min <= 0:
        raise SystemExit(f"{path}: need 0 < caution_slope_deg <= max_slope_deg <= 90 and a positive walk speed")
    return m


def slope_horn(dem: np.ndarray, px_m: float) -> np.ndarray:
    """Slope in degrees, Horn (1981). Edges use replicated borders; NaN propagates to neighbours."""
    z = np.pad(dem.astype("float64"), 1, mode="edge")
    a, b, c = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d, f = z[1:-1, :-2], z[1:-1, 2:]
    g, h, i = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * px_m)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * px_m)
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy)))


def aggregate_max(a: np.ndarray, k: int) -> np.ndarray:
    rows, cols = a.shape
    b = a[: rows - rows % k, : cols - cols % k].reshape(rows // k, k, cols // k, k)
    with np.errstate(all="ignore"):
        out = np.nanmax(b, axis=(1, 3))
    return out


def classify(slope: np.ndarray, m: WalkModel) -> np.ndarray:
    """0 go, 1 caution, 2 no-go, -1 nodata."""
    cls = np.full(slope.shape, -1, dtype="int8")
    ok = np.isfinite(slope)
    cls[ok & (slope < m.caution_slope_deg)] = GO
    cls[ok & (slope >= m.caution_slope_deg) & (slope < m.max_slope_deg)] = CAUTION
    cls[ok & (slope >= m.max_slope_deg)] = NOGO
    return cls


def speed_factor(slope: np.ndarray, m: WalkModel) -> np.ndarray:
    return np.interp(slope, m.speed_vs_slope[:, 0], m.speed_vs_slope[:, 1])


def cost_min_per_m(slope: np.ndarray, cls: np.ndarray, m: WalkModel) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        speed = m.walk_speed_flat_m_per_min * speed_factor(np.nan_to_num(slope), m)
        cost = 1.0 / speed
    cost[(cls < 0) | (cls == NOGO) | ~(speed > 0)] = np.nan
    return cost


def _rgb(hex_color: str) -> tuple[int, int, int]:
    return tuple(int(hex_color[i : i + 2], 16) for i in (1, 3, 5))  # type: ignore[return-value]


def colour_slope(slope: np.ndarray, legend: list[dict]) -> np.ndarray:
    """RGBA uint8: exact legend colours by (previous max_deg, max_deg] bins; alpha 0 on nodata."""
    out = np.zeros(slope.shape + (4,), dtype="uint8")
    lower = -np.inf
    for b in legend:
        sel = np.isfinite(slope) & (slope > lower) & (slope <= b["max_deg"])
        out[sel] = (*_rgb(b["color"]), 255)
        lower = b["max_deg"]
    return out


def colour_classes(cls: np.ndarray, legend: list[dict]) -> np.ndarray:
    """RGBA uint8 with the exact go / caution / no-go legend colours; alpha 0 on nodata."""
    by_name = {b["class"]: b["color"] for b in legend}
    out = np.zeros(cls.shape + (4,), dtype="uint8")
    for code, name in CLASS_NAMES.items():
        out[cls == code] = (*_rgb(by_name[name]), 255)
    return out

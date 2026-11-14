"""Task A7: "without the terrain model" variant of the cost to home.

Without a terrain model there is no slope information, so every cell that has data is walked at the
flat-ground speed (walk_speed_flat_m_per_min) and nothing is impassable. The envelope then becomes a
disc around the safe haven, which is what the web app's comparison (task Y9) contrasts with the
terrain-aware `cost_to_home_2m.f32`. Same MCP set-up as 05_cost_to_home.py.

Reads  $DATA_DIR/aoi.json, $DATA_DIR/<assets_base>slope_2m.f32 (data mask, A3), params file.
Writes $DATA_DIR/<assets_base>cost_to_home_flat_2m.f32 (+ .json): minutes, NaN = no data
       (contract: rasters.cost_to_home_flat, optional).
Prints the reachable share at the current budget for both variants as a check.

Run:   python pipeline/scripts/06_variants.py [--params model/params.json] [--haven X,Y]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from aoi import DATA_DIR, xy_to_pixel
from exportlib import write_f32
from homecost import cost_to_home
from slopecost import PARAMS_FILE


def flat_cost(data_mask: np.ndarray, walk_speed_m_per_min: float) -> np.ndarray:
    """min/m: 1 / flat speed wherever there is data, NaN elsewhere."""
    return np.where(data_mask, 1.0 / walk_speed_m_per_min, np.nan)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--params", type=Path, default=PARAMS_FILE)
    ap.add_argument("--haven", help="X,Y in AOI metres; default: safe_haven.xy in DATA_DIR/aoi.json")
    args = ap.parse_args()

    params = json.loads(args.params.read_text(encoding="utf-8"))
    speed = (params.get("walk_speed_flat_m_per_min") or {}).get("value")
    if speed is None:
        raise SystemExit(f"{args.params}: walk_speed_flat_m_per_min has no value yet (task B1). "
                         "For a local dev run pass --params <file> with Assumed values.")
    dev = args.params.resolve() != PARAMS_FILE.resolve()

    aoi = json.loads((DATA_DIR / "aoi.json").read_text(encoding="utf-8"))
    out = DATA_DIR / aoi["assets_base"]
    entry = aoi["rasters"]["cost_to_home_flat"]
    px = float(entry["px_m"])
    w, h = aoi["size_m"]
    cols, rows = round(w / px), round(h / px)
    slope = np.fromfile(out / aoi["rasters"]["slope_values"]["file"], dtype="<f4").reshape(rows, cols)
    haven_xy = tuple(float(v) for v in args.haven.split(",")) if args.haven else tuple(aoi["safe_haven"]["xy"])
    haven = xy_to_pixel(*haven_xy, px, h)

    minutes, _ = cost_to_home(flat_cost(np.isfinite(slope), float(speed)), px, haven)
    write_f32(out / entry["file"], minutes, px, {
        "unit": "min",
        "provenance": "Assumed (dev params)" if dev else "Modeled",
        "source": "flat-ground variant: every data cell at walk_speed_flat_m_per_min, no slope, nothing "
                  "impassable; skimage MCP_Geometric from the safe haven (pipeline 06_variants.py)",
        "haven_xy": list(haven_xy),
        "walk_speed_flat_m_per_min": float(speed),
        "max_finite_min": float(np.nanmax(minutes)),
        "reachable_share": float(np.isfinite(minutes).mean()),
    })

    budget = (params.get("budget_min") or {}).get("value") or aoi["model"]["budget_min"]
    reserve = (params.get("reserve_min") or {}).get("value") or aoi["model"]["reserve_min"]
    limit = budget - reserve
    terrain = out / aoi["rasters"]["cost_to_home"]["file"]
    print(f"wrote {entry['file']}; largest cost {np.nanmax(minutes):.1f} min (flat {speed} m/min)")
    if terrain.exists():
        t = np.fromfile(terrain, dtype="<f4").reshape(rows, cols)
        for half in (1.0, 0.25):
            lim = limit * half
            print(f"share of AOI with cost <= {lim:g} min: terrain {np.mean(t <= lim):.1%}, "
                  f"flat {np.mean(minutes <= lim):.1%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

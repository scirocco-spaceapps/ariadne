"""Task A4: cost-to-home raster and traceback from the safe haven.

Reads  $DATA_DIR/aoi.json (safe_haven.xy, rasters.cost_to_home) and $DATA_DIR/<assets_base>cost_2m.f32 (A3).
Writes $DATA_DIR/<assets_base>:
  cost_to_home_2m.f32 (+ .json)  minutes to the safe haven, NaN = unreachable (contract: rasters.cost_to_home)
  pred_2m.i32                    predecessor toward the haven as a linear cell index (row * width + col),
                                 -1 at the haven and where unreachable; little-endian int32, north-up
                                 (outside the contract, for path recovery)
Sidecar: width, height, px_m, min, max, haven_xy, haven_cell, max_finite_min, reachable_share.

Run:   python pipeline/scripts/05_cost_to_home.py [--haven X,Y]   (AOI metres; default aoi.json safe_haven)
"""

from __future__ import annotations

import argparse
import json
import sys

import numpy as np

from aoi import DATA_DIR, xy_to_pixel
from exportlib import write_f32
from homecost import cost_to_home


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--haven", help="X,Y in AOI metres; default: safe_haven.xy in DATA_DIR/aoi.json")
    args = ap.parse_args()

    aoi = json.loads((DATA_DIR / "aoi.json").read_text(encoding="utf-8"))
    out = DATA_DIR / aoi["assets_base"]
    entry = aoi["rasters"]["cost_to_home"]
    px = float(entry["px_m"])
    w, h = aoi["size_m"]
    cols, rows = round(w / px), round(h / px)

    cost_meta = json.loads((out / "cost_2m.f32.json").read_text(encoding="utf-8"))
    cost = np.fromfile(out / "cost_2m.f32", dtype="<f4").reshape(rows, cols)
    haven_xy = tuple(float(v) for v in args.haven.split(",")) if args.haven else tuple(aoi["safe_haven"]["xy"])
    haven = xy_to_pixel(*haven_xy, px, h)
    if not (0 <= haven[0] < rows and 0 <= haven[1] < cols):
        raise SystemExit(f"safe haven {haven_xy} is outside the AOI")
    if not np.isfinite(cost[haven]):
        raise SystemExit(f"safe haven {haven_xy} (cell {haven}) is on an impassable cell; choose another point")

    minutes, pred = cost_to_home(cost, px, haven)
    reach = np.isfinite(minutes)
    summary = {
        "haven_xy": list(haven_xy),
        "haven_cell": list(haven),
        "max_finite_min": float(np.nanmax(minutes)),
        "reachable_share": float(reach.mean()),
    }
    write_f32(out / entry["file"], minutes, px, {
        "unit": "min",
        "provenance": "Modeled" if cost_meta.get("provenance") == "Derived" else
                      f"Modeled on {cost_meta.get('provenance')} cost",
        "source": "skimage MCP_Geometric from the safe haven over cost_2m.f32 (pipeline 05_cost_to_home.py)",
        **summary,
    })
    np.ascontiguousarray(pred, dtype="<i4").tofile(out / "pred_2m.i32")
    print(f"haven {list(haven_xy)} -> cell {list(haven)}")
    print(f"largest finite cost to home: {summary['max_finite_min']:.1f} min")
    print(f"reachable share of the AOI: {summary['reachable_share']:.1%}")
    print(f"wrote {entry['file']} (+ .json) and pred_2m.i32 to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

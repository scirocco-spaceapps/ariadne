"""Task A3: slope and traversability PNGs, slope values and the walking-cost grid.

Reads  $ARIADNE_WORK/dem_1m.tif (A1), the params file (default model/params.json), and the legends
       of rasters.slope and rasters.traversability in contracts/aoi.json.
Writes $DATA_DIR/<assets_base>:
  slope_2m.png           RGBA, exact slope-legend colours, alpha 0 on nodata, no anti-aliasing
  slope_2m.legend.json   copy of rasters.slope.legend (aoi.json is the source; the copy must match it)
  slope_2m.f32 (+ .json) slope in degrees, NaN nodata (optional slope_values entry)
  traversability_2m.png  RGBA, exact go / caution / no-go colours, alpha 0 on nodata
  cost_2m.f32 (+ .json)  minutes per metre, NaN = impassable (outside the contract; planner and A4 read it)

Run:   python pipeline/scripts/04_cost.py [--params model/params.json]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image

from aoi import DATA_DIR, WORK_DIR
from exportlib import write_f32
from slopecost import (CAUTION, GO, NOGO, PARAMS_FILE, aggregate, classify, colour_classes, colour_slope,
                       cost_min_per_m, load_params, slope_horn)

PUBLISHED_AOI = DATA_DIR / "aoi.json"  # written by 03_export.py


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--params", type=Path, default=PARAMS_FILE, help="walk-model params JSON")
    args = ap.parse_args()

    m = load_params(args.params)
    dev = args.params.resolve() != PARAMS_FILE.resolve()
    aoi = json.loads(PUBLISHED_AOI.read_text(encoding="utf-8"))
    r = aoi["rasters"]
    out = DATA_DIR / aoi["assets_base"]
    px2 = float(r["slope"]["px_m"])

    with rasterio.open(WORK_DIR / "dem_1m.tif") as src:
        px1 = float(src.res[0])
        dem = src.read(1).astype("float64")
        if src.nodata is not None and np.isfinite(src.nodata):
            dem[dem == src.nodata] = np.nan

    slope = aggregate(slope_horn(dem, px1), int(round(px2 / px1)), "mean")
    cls = classify(slope, m)
    cost = cost_min_per_m(slope, cls, m)

    prov = "Assumed (dev params file, not model/params.json)" if dev else "Derived"
    src_note = f"HiRISE DTM 1 m via pipeline 04_cost.py; params {args.params}"
    Image.fromarray(colour_slope(slope, r["slope"]["legend"]), "RGBA").save(out / r["slope"]["file"])
    (out / "slope_2m.legend.json").write_text(json.dumps(r["slope"]["legend"], indent=2, ensure_ascii=False),
                                              encoding="utf-8")
    write_f32(out / r["slope_values"]["file"], slope, px2,
              {"unit": "deg", "provenance": "Derived", "source": "Horn slope of the HiRISE DTM 1 m, mean over 2 x 2"})
    Image.fromarray(colour_classes(cls, r["traversability"]["legend"]), "RGBA").save(out / r["traversability"]["file"])
    meta = write_f32(out / "cost_2m.f32", cost, px2,
                     {"unit": "min/m", "provenance": prov, "source": src_note,
                      "impassable": "NaN (no-go or no data)", "params_provenance": m.provenance})

    valid = cls >= 0
    share = {name: float((cls == code).sum() / max(valid.sum(), 1)) for code, name in
             ((GO, "go"), (CAUTION, "caution"), (NOGO, "no-go"))}
    print(f"params: {args.params}{'  (DEV, Assumed)' if dev else ''}")
    print(f"slope 2 m: min {np.nanmin(slope):.1f}  median {np.nanmedian(slope):.1f}  max {np.nanmax(slope):.1f} deg")
    print("classes: " + ", ".join(f"{k} {v:.1%}" for k, v in share.items()) + f", nodata {(~valid).mean():.2%}")
    print(f"cost: {meta['min']:.4f}..{meta['max']:.4f} min/m; wrote slope, traversability and cost to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Task A1, step 2: rover track and waypoints in AOI metres, plus the quicklook.

Reads  $ARIADNE_RAW/M20_traverse.json, $ARIADNE_RAW/M20_waypoints.json,
       $ARIADNE_WORK/ortho_25cm.tif and dem_1m.tif (from 01_crop.sh).
Writes $ARIADNE_WORK/track.geojson, waypoints.geojson, quicklook.png.
Prints the campaign check (sols 1170-1290 inside the AOI) and the nodata share of both rasters.

Run: python pipeline/scripts/02_track.py [--no-quicklook]
"""

from __future__ import annotations

import argparse
import json
import sys

import numpy as np
import rasterio
from PIL import Image, ImageDraw
from rasterio.enums import Resampling

from aoi import RAW_DIR, WORK_DIR, load_frame
from tracklib import sol_range_report, track_collection, waypoint_collection

CAMPAIGN = (1170, 1290)  # Neretva Vallis / Bright Angel, task A1
SOL_1250 = 1250
QUICKLOOK_PX_M = 1.0


def nodata_share(path, nodata_is_nan: bool) -> float:
    with rasterio.open(path) as src:
        a = src.read(1)
        if nodata_is_nan:
            bad = ~np.isfinite(a)
        else:
            bad = a == (src.nodata if src.nodata is not None else 0)
            if src.nodata is None or np.issubdtype(a.dtype, np.floating):
                bad |= ~np.isfinite(a.astype("float64"))
    return float(bad.mean())


def quicklook(frame, track: dict, waypoints: dict, out) -> None:
    w_m, h_m = frame.size_m
    cols, rows = int(w_m / QUICKLOOK_PX_M), int(h_m / QUICKLOOK_PX_M)
    with rasterio.open(WORK_DIR / "ortho_25cm.tif") as src:
        a = src.read(1, out_shape=(rows, cols), resampling=Resampling.average)
    img = Image.fromarray(a).convert("RGB")
    draw = ImageDraw.Draw(img)

    def px(x, y):
        return x / QUICKLOOK_PX_M, (h_m - y) / QUICKLOOK_PX_M

    for f in track["features"]:
        draw.line([px(*c) for c in f["geometry"]["coordinates"]], fill=(255, 60, 60), width=3)
    for f in waypoints["features"]:
        x, y = px(*f["geometry"]["coordinates"])
        draw.ellipse([x - 5, y - 5, x + 5, y + 5], outline=(255, 220, 0), width=2)
        if f["properties"]["sol"] == SOL_1250:
            draw.text((x + 8, y - 8), "sol 1250", fill=(255, 220, 0))
    draw.text((10, 10), "QUICKLOOK - HiRISE ortho (USGS) + Mars 2020 traverse (MMGIS), AOI metres, north up",
              fill=(255, 255, 255))
    img.save(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-quicklook", action="store_true", help="only write the GeoJSON files")
    args = ap.parse_args()

    frame = load_frame()
    traverse = json.loads((RAW_DIR / "M20_traverse.json").read_text(encoding="utf-8"))
    wps = json.loads((RAW_DIR / "M20_waypoints.json").read_text(encoding="utf-8"))

    sol1250 = [f for f in wps["features"] if f["properties"].get("sol") == SOL_1250]
    for f in sol1250:
        lon, lat = f["geometry"]["coordinates"][:2]
        print(f"sol {SOL_1250}: lon {lon:.5f} E, lat {lat:.5f} N -> AOI xy "
              f"{[round(v, 1) for v in frame.lonlat_to_aoi(lon, lat)]}")
    rep = sol_range_report(wps, frame, *CAMPAIGN)
    print(f"sols {CAMPAIGN[0]}-{CAMPAIGN[1]}: {rep['count']} waypoints, x {rep['x_range']}, y {rep['y_range']}, "
          f"outside AOI: {rep['outside'] or 'none'}")

    track = track_collection(traverse, frame)
    waypoints = waypoint_collection(wps, frame)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    for name, coll in (("track.geojson", track), ("waypoints.geojson", waypoints)):
        (WORK_DIR / name).write_text(json.dumps(coll, separators=(",", ":")), encoding="utf-8")
        print(f"wrote {WORK_DIR / name}: {len(coll['features'])} features")

    if not args.no_quicklook:
        for name, is_nan in (("dem_1m.tif", True), ("ortho_25cm.tif", False)):
            print(f"nodata share {name}: {nodata_share(WORK_DIR / name, is_nan):.4%}")
        quicklook(frame, track, waypoints, WORK_DIR / "quicklook.png")
        print(f"wrote {WORK_DIR / 'quicklook.png'}")
    return 1 if rep["outside"] else 0


if __name__ == "__main__":
    sys.exit(main())

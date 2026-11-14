"""Task A2: web assets from the cropped rasters.

Reads  $ARIADNE_WORK/ortho_25cm.tif, dem_1m.tif, track.geojson, waypoints.geojson (A1).
Writes $DATA_DIR/<assets_base>: ortho_50cm.jpg, ortho_1m.jpg, dem_4m.f32 (+ .json sidecar),
       hillshade_2m.png, track.geojson, waypoints.geojson, dem_1m.tif;
       and $DATA_DIR/aoi.json: a copy of contracts/aoi.json, the file the planner reads (AOI_PATH default).

Run:   python pipeline/scripts/03_export.py          # export, then check
       python pipeline/scripts/03_export.py --check  # only check what is published
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling

from aoi import CONTRACT_AOI, DATA_DIR, WORK_DIR
from exportlib import block_reduce, check_f32, check_image, hillshade, write_f32

JPEG_QUALITY = 85
SOURCE_DTM = "USGS Mars 2020 TRN HiRISE DTM mosaic (JEZ_hirise_soc_006 DTM 1 m), reprojected to crs.proj4"
SOURCE_ORTHO = "USGS Mars 2020 TRN HiRISE orthomosaic (JEZ_hirise_soc_006 25 cm), reprojected to crs.proj4"


def published_aoi() -> dict:
    """The contract as published next to the assets."""
    return json.loads(CONTRACT_AOI.read_text(encoding="utf-8"))


def export(aoi: dict) -> None:
    size = tuple(aoi["size_m"])
    r = aoi["rasters"]
    out = DATA_DIR / aoi["assets_base"]
    out.mkdir(parents=True, exist_ok=True)

    # Ortho JPEGs: average-downsample the 25 cm crop (grey, 1 band).
    with rasterio.open(WORK_DIR / "ortho_25cm.tif") as src:
        for key in ("ortho", "ortho_small"):
            cols, rows = round(size[0] / r[key]["px_m"]), round(size[1] / r[key]["px_m"])
            a = src.read(1, out_shape=(rows, cols), resampling=Resampling.average)
            Image.fromarray(a).save(out / r[key]["file"], quality=JPEG_QUALITY, optimize=True)
            print(f"wrote {r[key]['file']} {cols}x{rows}")

    with rasterio.open(WORK_DIR / "dem_1m.tif") as src:
        dem1 = src.read(1).astype("float64")
        if src.nodata is not None and np.isfinite(src.nodata):
            dem1[dem1 == src.nodata] = np.nan

    # DEM 4 m (mean of 4 x 4 one-metre cells).
    px = float(r["dem"]["px_m"])
    meta = write_f32(out / r["dem"]["file"], block_reduce(dem1, int(px)), px,
                     {"unit": "m", "provenance": "Observed", "source": SOURCE_DTM + "; 4 x 4 block mean"})
    print(f"wrote {r['dem']['file']} {meta['width']}x{meta['height']} min {meta['min']:.1f} max {meta['max']:.1f} m")

    # Hillshade 2 m (sun azimuth 315°, altitude 45°).
    px = float(r["hillshade"]["px_m"])
    hs = hillshade(block_reduce(dem1, int(px)), px)
    Image.fromarray(hs, mode="L").save(out / r["hillshade"]["file"], optimize=True)
    print(f"wrote {r['hillshade']['file']} {hs.shape[1]}x{hs.shape[0]}")

    for key in ("track", "waypoints"):
        shutil.copyfile(WORK_DIR / aoi["vectors"][key], out / aoi["vectors"][key])
    if "dem_geotiff" in r:
        shutil.copyfile(WORK_DIR / "dem_1m.tif", out / r["dem_geotiff"]["file"])
    (DATA_DIR / "aoi.json").write_text(json.dumps(aoi, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote vectors, {r.get('dem_geotiff', {}).get('file', '')} and {DATA_DIR / 'aoi.json'}")


def check(aoi: dict) -> list[str]:
    """Sizes of everything A2 publishes, sidecars, GeoJSON schemas. Later cards' files are listed, not failed."""
    sys.path.insert(0, str(CONTRACT_AOI.parent))
    import check as contract  # contracts/check.py validator

    size = tuple(aoi["size_m"])
    r = aoi["rasters"]
    out = DATA_DIR / aoi["assets_base"]
    errs: list[str] = []
    errs += check_image(out / r["ortho"]["file"], size, r["ortho"]["px_m"])
    errs += check_image(out / r["ortho_small"]["file"], size, r["ortho_small"]["px_m"])
    errs += check_image(out / r["hillshade"]["file"], size, r["hillshade"]["px_m"])
    errs += check_f32(out / r["dem"]["file"], size, r["dem"]["px_m"])
    if "dem_geotiff" in r:
        with rasterio.open(out / r["dem_geotiff"]["file"]) as src:
            want = (round(size[0] / r["dem_geotiff"]["px_m"]), round(size[1] / r["dem_geotiff"]["px_m"]))
            if (src.width, src.height) != want:
                errs.append(f"{r['dem_geotiff']['file']}: {(src.width, src.height)}, expected {want}")
    for key, schema in (("track", "TrackCollection"), ("waypoints", "WaypointCollection")):
        coll = json.loads((out / aoi["vectors"][key]).read_text(encoding="utf-8"))
        n = len(contract.errors)
        contract.validate(coll, schema, aoi["vectors"][key])
        errs += contract.errors[n:]
        for f in coll["features"]:
            g = f["geometry"]
            pts = [g["coordinates"]] if g["type"] == "Point" else g["coordinates"]
            if any(not (0 <= x <= size[0] and 0 <= y <= size[1]) for x, y in pts):
                errs.append(f"{aoi['vectors'][key]}: coordinates outside size_m (must be AOI metres)")
                break
    later = [e["file"] for k, e in r.items() if not e.get("optional") and not (out / e["file"]).exists()]
    if later:
        print(f"not published yet (later cards): {', '.join(later)}")
    return errs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="only check the published files")
    args = ap.parse_args()
    aoi = published_aoi()
    if not args.check:
        export(aoi)
    errs = check(aoi)
    for e in errs:
        print(f"CHECK FAIL: {e}")
    print("check passed" if not errs else f"{len(errs)} check failure(s)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())

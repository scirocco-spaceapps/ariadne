"""Task A6: check and publish the science outputs of notebooks/out/ (B3) as assets.

Reads  notebooks/out/seen_not_touched_2m.png and notebooks/out/targets.geojson (Bunyamin, task B3).
Checks against contracts/aoi.json and openapi.yaml:
  - PNG: exactly size_m / px_m of rasters.seen_not_touched, RGBA, at most two distinct values
    (transparent or one colour: no anti-aliasing);
  - GeoJSON: validates as TargetCollection, every point inside the AOI (AOI metres, not lon/lat);
  - reports each target's cost to home when cost_to_home_2m.f32 is published.
Copies both to $DATA_DIR/<assets_base> under the names in aoi.json (rasters.seen_not_touched,
vectors.targets). Nothing is copied when a check fails.

Run:   python pipeline/scripts/08_publish_science.py [--check]
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from aoi import CONTRACT_AOI, DATA_DIR, REPO

OUT = REPO / "notebooks" / "out"


def check_png(path: Path, size_m: tuple[float, float], px_m: float) -> list[str]:
    want = (round(size_m[0] / px_m), round(size_m[1] / px_m))
    with Image.open(path) as im:
        errs = [] if im.size == want else [f"{path.name}: {im.size}, expected {want}"]
        if im.mode != "RGBA":
            errs.append(f"{path.name}: mode {im.mode}, expected RGBA (alpha 0 where false)")
            return errs
        a = np.asarray(im).reshape(-1, 4)
    values = {tuple(v) for v in np.unique(a, axis=0)}
    if len(values) > 2:
        errs.append(f"{path.name}: {len(values)} distinct RGBA values, expected at most 2 (no anti-aliasing)")
    return errs


def check_targets(coll: dict, size_m: tuple[float, float]) -> list[str]:
    sys.path.insert(0, str(CONTRACT_AOI.parent))
    import check as contract

    n = len(contract.errors)
    contract.validate(coll, "TargetCollection", "targets.geojson")
    errs = list(contract.errors[n:])
    for f in coll.get("features", []):
        x, y = f["geometry"]["coordinates"][:2]
        if not (0 <= x <= size_m[0] and 0 <= y <= size_m[1]):
            errs.append(f"targets.geojson: {f['properties'].get('id')} at {[x, y]} is outside size_m (AOI metres?)")
    ids = [f["properties"].get("id") for f in coll.get("features", [])]
    if len(ids) != len(set(ids)):
        errs.append(f"targets.geojson: duplicate ids {ids}")
    return errs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="only check, do not copy")
    args = ap.parse_args()

    aoi = json.loads(CONTRACT_AOI.read_text(encoding="utf-8"))
    size = (float(aoi["size_m"][0]), float(aoi["size_m"][1]))
    snt = aoi["rasters"]["seen_not_touched"]
    tgt_name = aoi["vectors"]["targets"]["file"]
    png, geo = OUT / "seen_not_touched_2m.png", OUT / "targets.geojson"
    targets = json.loads(geo.read_text(encoding="utf-8"))

    errs = check_png(png, size, float(snt["px_m"])) + check_targets(targets, size)
    base = DATA_DIR / aoi["assets_base"]
    cth = base / aoi["rasters"]["cost_to_home"]["file"]
    if cth.exists():
        px = float(aoi["rasters"]["cost_to_home"]["px_m"])
        grid = np.fromfile(cth, dtype="<f4").reshape(round(size[1] / px), round(size[0] / px))
        for f in targets["features"]:
            x, y = f["geometry"]["coordinates"][:2]
            t = grid[min(int((size[1] - y) // px), grid.shape[0] - 1), min(int(x // px), grid.shape[1] - 1)]
            print(f"  {f['properties']['id']}: cost to home {t:.1f} min" + ("" if np.isfinite(t) else "  (UNREACHABLE)"))
    for e in errs:
        print(f"CHECK FAIL: {e}")
    if errs:
        return 1
    print(f"checks passed: {png.name}, {geo.name} ({len(targets['features'])} targets)")
    if not args.check:
        shutil.copyfile(png, base / snt["file"])
        shutil.copyfile(geo, base / tgt_name)
        print(f"published {snt['file']} and {tgt_name} to {base}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

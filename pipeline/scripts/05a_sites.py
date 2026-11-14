"""Task A4, step 1: safe haven and stops from content/stops/index.json -> AOI metres, proposal for aoi.json.

Reads  content/stops/index.json (B2: entries {id, name, lon, lat, sol, source_url, why}; the safe haven is
       the entry with id "haven" or kind "safe_haven"), $DATA_DIR/<assets_base>cost_2m.f32 (A3), the params
       file (budget_min, reserve_min, dwell_min).
Writes $ARIADNE_WORK/aoi_sites_proposal.json: {safe_haven, stops, model} for the aoi.json PR to Yusuf.
Reports every place outside the AOI or on an impassable cell.

Run:   python pipeline/scripts/05a_sites.py [--params model/params.json]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from aoi import DATA_DIR, REPO, WORK_DIR, Frame, load_frame, xy_to_pixel
from slopecost import PARAMS_FILE

INDEX = REPO / "content" / "stops" / "index.json"
MODEL_KEYS = ("budget_min", "reserve_min", "dwell_min")


def is_haven(e: dict) -> bool:
    return e.get("id") == "haven" or e.get("kind") == "safe_haven"


def convert(entries: list[dict], frame: Frame, cost: np.ndarray, px_m: float) -> tuple[dict | None, list[dict], list[str]]:
    """(safe_haven, stops, problems) with xy in AOI metres rounded to 0.1 m."""
    rows, cols = cost.shape
    h = frame.size_m[1]
    problems: list[str] = []
    places = []
    for e in entries:
        x, y = (float(v) for v in frame.lonlat_to_aoi(e["lon"], e["lat"]))
        place = {"id": e["id"], "name": e["name"], "xy": [round(x, 1), round(y, 1)]}
        if not frame.inside(x, y):
            problems.append(f"{e['id']} ({e['name']}) at {place['xy']} is outside the AOI")
        else:
            r, c = xy_to_pixel(x, y, px_m, h)
            r, c = min(r, rows - 1), min(c, cols - 1)
            if not np.isfinite(cost[r, c]):
                problems.append(f"{e['id']} ({e['name']}) at {place['xy']} is on an impassable cell")
        places.append((e, place))
    havens = [p for e, p in places if is_haven(e)]
    if len(havens) != 1:
        problems.append(f"expected exactly one safe haven entry, found {len(havens)}")
    stops = [p for e, p in places if not is_haven(e)]
    return (havens[0] if havens else None), stops, problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--params", type=Path, default=PARAMS_FILE)
    ap.add_argument("--index", type=Path, default=INDEX)
    args = ap.parse_args()

    entries = json.loads(args.index.read_text(encoding="utf-8"))
    if not entries:
        print(f"{args.index} is empty: stops and safe haven come from task B2 (Bunyamin). Nothing to propose yet.")
        return 0
    frame = load_frame()
    aoi = json.loads((DATA_DIR / "aoi.json").read_text(encoding="utf-8"))
    px = 2.0
    w, h = aoi["size_m"]
    cost = np.fromfile(DATA_DIR / aoi["assets_base"] / "cost_2m.f32", dtype="<f4").reshape(round(h / px), round(w / px))
    haven, stops, problems = convert(entries, frame, cost, px)

    params = json.loads(args.params.read_text(encoding="utf-8"))
    model = {k: (params.get(k) or {}).get("value") for k in MODEL_KEYS}
    if any(v is None for v in model.values()):
        problems.append(f"model values missing in {args.params}: {[k for k, v in model.items() if v is None]} (B1)")

    proposal = {"safe_haven": haven, "stops": stops, "model": model}
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    (WORK_DIR / "aoi_sites_proposal.json").write_text(json.dumps(proposal, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(proposal, indent=2, ensure_ascii=False))
    for p in problems:
        print(f"PROBLEM: {p}")
    print(f"wrote {WORK_DIR / 'aoi_sites_proposal.json'}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

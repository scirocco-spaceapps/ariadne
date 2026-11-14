"""Task B4, conditions: one sol of Mars 2020 MEDA weather -> content/conditions/meda.json.

Reads two PDS products for the sol (downloaded once into data/meda/, git-ignored):
  - data_calibrated_env  CAL_ATS: air temperature, kelvin, five sensors
  - data_derived_env     DER_PS:  pressure, pascal

Method (state it wherever the numbers are shown):
  - Air temperature: at each time step take the median of the three mast (RSM) sensors
    ATS_LOCAL_TEMP1-3; the two body (RFB) sensors are left out because the rover body heats them.
    Daily min and max are the min and max of that median over the sol.
  - Pressure: mean of DER_PS PRESSURE over the sol.
  - Dust opacity: MEDA has no opacity product in the PDS bundle (RDS is calibrated irradiance only),
    so it is null.

Run:  python notebooks/meda_sol.py [--sol 1215]
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CACHE = REPO / "data" / "meda"
OUT = REPO / "content" / "conditions" / "meda.json"
BUNDLE = "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda"
DATASET_DOI = "https://doi.org/10.17189/1522849"
MAST = ("ATS_LOCAL_TEMP1", "ATS_LOCAL_TEMP2", "ATS_LOCAL_TEMP3")


def sol_dir(collection: str, sol: int) -> str:
    lo = 1140 + 120 * ((sol - 1140) // 120) if sol >= 1140 else None
    if lo is None:
        raise SystemExit("only sols >= 1140 are mapped here; extend sol_dir for earlier ranges")
    return f"{BUNDLE}/{collection}/sol_{lo:04d}_{lo + 119:04d}/sol_{sol:04d}"


def fetch(url: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / url.rsplit("/", 1)[1]
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    return path


def product_url(collection: str, sol: int, level: str, sensor: str, version: str) -> str:
    name = f"WE__{sol:04d}___________{level}_{sensor:_<20}{version}.CSV"
    return f"{sol_dir(collection, sol)}/{name}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sol", type=int, default=1215, help="default 1215: Sapphire Canyon core at Cheyava Falls")
    args = ap.parse_args()

    ats_url = product_url("data_calibrated_env", args.sol, "CAL", "ATS", "P01")
    ps_url = product_url("data_derived_env", args.sol, "DER", "PS", "P01")

    med = []
    for row in csv.DictReader(fetch(ats_url).open(encoding="utf-8")):
        vals = [row[c].strip() for c in MAST]
        if all(vals):
            med.append(statistics.median(float(v) for v in vals))
    pressure = [float(r["PRESSURE"]) for r in csv.DictReader(fetch(ps_url).open(encoding="utf-8")) if r["PRESSURE"].strip()]
    if not med or not pressure:
        raise SystemExit("no usable MEDA rows for this sol")

    out = {
        "sol": args.sol,
        "values": {
            "air_temp_min": round(min(med), 1),
            "air_temp_max": round(max(med), 1),
            "pressure": round(statistics.mean(pressure), 1),
            "dust_opacity": None,
        },
        "units": {"air_temp_min": "K", "air_temp_max": "K", "pressure": "Pa", "dust_opacity": "1"},
        "source": (
            f"Mars 2020 MEDA, NASA PDS Atmospheres Node (dataset doi:10.17189/1522849), sol {args.sol}. "
            "Air temperature: CAL_ATS, daily min/max of the median of the three mast sensors. "
            "Pressure: DER_PS, mean over the sol. Dust opacity: no MEDA opacity product in PDS, left null."
        ),
        "source_url": DATASET_DOI,
        "provenance": "Derived",
        "files": [ats_url, ps_url],
        "samples": {"air_temp": len(med), "pressure": len(pressure)},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out["values"]), "->", OUT.relative_to(REPO))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

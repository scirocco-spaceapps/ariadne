#!/usr/bin/env bash
# Package the published assets for the live host (until the server exists: Nuri's laptop, ASSETS_DIR).
#
# Output: $ARIADNE_BUNDLES/ariadne-assets-<UTC time>.zip (default ~/ariadne-data/bundles) containing
#   aoi.json                  the AOI the planner reads (default: contracts/aoi.json of this checkout;
#                             pass another file as $1, e.g. a contracts PR's aoi.json, to ship it early)
#   bright-angel/...          every file of DATA_DIR/<assets_base>: rasters with sidecars, GeoJSON,
#                             cost_2m.f32 (planner routing), cost_to_home(_flat) and the legend JSON
#   BUNDLE.txt                what is inside and where it came from
# pred_2m.i32 is left out (no service reads it). Raw downloads and work files are never included.
#
# The receiver unpacks it into one folder and points ASSETS_DIR (infra/.env.laptop) at that folder.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
DATA="${DATA_DIR:-$HOME/ariadne-data/assets}"
OUT="${ARIADNE_BUNDLES:-$HOME/ariadne-data/bundles}"
PY="${PYTHON:-python}"
AOI_SRC="${1:-$REPO/contracts/aoi.json}"
AOI_LABEL="${AOI_LABEL:-$AOI_SRC}"  # how BUNDLE.txt names the aoi.json source

BASE="$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1]))["assets_base"])' "$AOI_SRC")"
[ -d "$DATA/$BASE" ] || { echo "no $DATA/$BASE; run 03_export.py and 04-06 first" >&2; exit 1; }

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp "$AOI_SRC" "$STAGE/aoi.json"
mkdir -p "$STAGE/$BASE"
for f in "$DATA/$BASE"*; do
  case "$(basename "$f")" in pred_2m.i32) continue ;; esac
  cp "$f" "$STAGE/$BASE"
done

# Every file listed in aoi.json must be present (optional ones may be missing), plus cost_2m.f32.
DATA_DIR="$STAGE" "$PY" - "$STAGE/aoi.json" <<'EOF'
import json, sys
from pathlib import Path
aoi = json.load(open(sys.argv[1])); base = Path(sys.argv[1]).parent / aoi["assets_base"]
missing = [e["file"] for e in aoi["rasters"].values() if not e.get("optional") and not (base / e["file"]).exists()]
missing += [v if isinstance(v, str) else v["file"] for v in aoi["vectors"].values()
            if (isinstance(v, str) or not v.get("optional")) and not (base / (v if isinstance(v, str) else v["file"])).exists()]
missing += [] if (base / "cost_2m.f32").exists() else ["cost_2m.f32"]
if missing:
    sys.exit(f"bundle incomplete, missing: {', '.join(missing)}")
EOF

STAMP="$(date -u +%Y%m%dT%H%MZ)"
{
  echo "Ariadne assets bundle $STAMP"
  echo "aoi.json from: $AOI_LABEL (checkout at git $(git -C "$REPO" rev-parse --short HEAD))"
  echo "model/params.json at git $(git -C "$REPO" log -1 --format=%h -- model/params.json)"
  echo "Unpack into one folder; set ASSETS_DIR to it. The planner reads ASSETS_DIR/aoi.json."
  echo
  (cd "$STAGE" && find . -type f ! -name BUNDLE.txt | sort | while read -r f; do
     printf '%10s  %s\n' "$(wc -c <"$f" | tr -d ' ')" "${f#./}"; done)
} >"$STAGE/BUNDLE.txt"

mkdir -p "$OUT"
ZIP="$OUT/ariadne-assets-$STAMP.zip"
(cd "$STAGE" && zip -qr "$ZIP" .)
echo "wrote $ZIP ($(du -h "$ZIP" | cut -f1))"

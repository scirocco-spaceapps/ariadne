#!/usr/bin/env bash
# Task A1, step 1: warp the padded native crops into the local AOI CRS.
#
# Inputs  (ARIADNE_RAW, default ~/ariadne-data/raw):
#   dtm_raw.tif    padded crop of the USGS Mars 2020 TRN HiRISE DTM, 1 m, Equirectangular Mars 2000
#                  sphere, latitude of true scale 0 (gdal_translate -projwin, see pipeline/CLAUDE.md)
#   ortho_raw.tif  padded crop of the USGS HiRISE orthomosaic, 25 cm, same CRS
# Outputs (ARIADNE_WORK, default ~/ariadne-data/work):
#   dem_1m.tif      1 m, bilinear, NaN nodata
#   ortho_25cm.tif  0.25 m, cubic, 0 nodata
# Target CRS and extent come from pipeline/scripts/aoi.py (crs.proj4 + origin_lonlat + size_m), so the
# east-west stretch of the source (true scale at the equator, ~5 % at 18.5 N) is removed here.
#
# Uses gdalwarp from PATH if present, else the GDAL Docker image.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
RAW="${ARIADNE_RAW:-$HOME/ariadne-data/raw}"
WORK="${ARIADNE_WORK:-$HOME/ariadne-data/work}"
PY="${PYTHON:-python}"
IMAGE="${GDAL_IMAGE:-ghcr.io/osgeo/gdal:ubuntu-small-latest}"
mkdir -p "$WORK"

PROJ4="$("$PY" "$HERE/aoi.py" --proj4)"
read -r XMIN YMIN XMAX YMAX <<<"$("$PY" "$HERE/aoi.py" --te)"
echo "target CRS: $PROJ4"
echo "extent (projected m): $XMIN $YMIN $XMAX $YMAX"

if command -v gdalwarp >/dev/null 2>&1; then
  warp() { gdalwarp "$@"; }
  IN="$RAW"; OUT="$WORK"
else
  warp() { docker run --rm -v "$RAW:/raw:ro" -v "$WORK:/out" "$IMAGE" gdalwarp "$@"; }
  IN=/raw; OUT=/out
fi

COMMON=(-overwrite -t_srs "$PROJ4" -te "$XMIN" "$YMIN" "$XMAX" "$YMAX" -multi -wo NUM_THREADS=ALL_CPUS
        -co TILED=YES -co BIGTIFF=IF_SAFER)

warp "${COMMON[@]}" -tr 1 1 -r bilinear -dstnodata nan -co COMPRESS=DEFLATE -co PREDICTOR=3 \
  "$IN/dtm_raw.tif" "$OUT/dem_1m.tif"
warp "${COMMON[@]}" -tr 0.25 0.25 -r cubic -srcnodata 0 -dstnodata 0 -co COMPRESS=DEFLATE \
  "$IN/ortho_raw.tif" "$OUT/ortho_25cm.tif"

echo "wrote $WORK/dem_1m.tif and $WORK/ortho_25cm.tif"

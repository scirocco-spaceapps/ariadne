# pipeline/

**Owner:** Ali Koray.

**Purpose:** offline scripts that turn NASA products (orthoimage, DEM, derived slope) into the
files listed in `contracts/aoi.json`, in the local metric plane (x east, y north, metres from the
AOI south-west corner; rasters north-up, row 0 north). Raw downloads go in `data/` (git-ignored).

**Run:** `python -m venv pipeline/.venv && source pipeline/.venv/bin/activate` (Python 3.11-3.13;
rasterio has no wheel for newer versions yet), then
`pip install -r pipeline/requirements.txt -r contracts/requirements.txt pytest` and
`python pipeline/scripts/<script>.py`.

**Folders** (env vars; laptop defaults under `~/ariadne-data/`, server uses `/srv/...`):
`ARIADNE_RAW` raw downloads and padded native crops, `ARIADNE_WORK` products in the local CRS,
`DATA_DIR` published assets (`DATA_DIR/<assets_base><file>`).

**Order:**
1. Padded native crops (A0), outside the repo, with GDAL (Docker image `ghcr.io/osgeo/gdal:ubuntu-small-latest`,
   env `GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif`):
   `gdal_translate -projwin_srs "+proj=longlat +R=3396190 +no_defs" -projwin 77.26 18.52 77.34 18.46 /vsicurl/<USGS url> $ARIADNE_RAW/dtm_raw.tif`
   (and `ortho_raw.tif`); the M20 JSON layers go in `$ARIADNE_RAW` too.
2. `scripts/01_crop.sh`: warp both crops to `crs.proj4` over the AOI (DEM 1 m, ortho 0.25 m).
3. `scripts/02_track.py`: track and waypoints GeoJSON in AOI metres, campaign check, quicklook, nodata share.
4. `scripts/03_export.py`: web assets to `DATA_DIR/<assets_base>` plus `DATA_DIR/aoi.json` (the planner's AOI);
   `--check` re-checks sizes, sidecars and GeoJSON schemas. `scripts/serve_assets.py` serves `DATA_DIR`
   with CORS on :8001 until the assets host is up (`VITE_ASSETS_URL=http://localhost:8001/`).
5. `scripts/04_cost.py [--params FILE]`: slope (2 m = mean of 1 m Horn slopes) and traversability PNGs, `slope_2m.f32`, `cost_2m.f32` from
   `model/params.json` (stops with a clear message while B1 values are null; a `--params` dev file is Assumed).
6. `scripts/05a_sites.py`: stops and safe haven from `content/stops/index.json` (B2) to AOI metres, passable check,
   `aoi_sites_proposal.json` for the aoi.json PR. `scripts/05_cost_to_home.py [--haven X,Y]`: `cost_to_home_2m.f32`
   and `pred_2m.i32` from the safe haven.
7. `scripts/06_variants.py`: `cost_to_home_flat_2m.f32`, the "without the terrain model" variant (task Y9 compares).
8. `scripts/07_bundle.sh [aoi.json]`: zip of `aoi.json` + `DATA_DIR/<assets_base>` for the live host
   (`~/ariadne-data/bundles/`); the receiver points `ASSETS_DIR` at the unpacked folder.
9. `scripts/08_publish_science.py [--check]`: checks B3's `notebooks/out/` (seen_not_touched PNG, targets.geojson)
   against the contract and copies them into `DATA_DIR/<assets_base>`.

**AOI frame:** `scripts/aoi.py` reads `contracts/aoi.json` (proj4, origin, size); no local override.

**Test:** `cd pipeline && python -m pytest`; outputs must pass the size rules in `contracts/check.py`
when pointed at a real AOI.

**Rules:** every product you write gets a line in `docs/DATA_SOURCES.md` (value, source, provenance).
Never commit rasters from real data; they go to the asset host (`assets_base`).

**Must not touch:** `contracts/` (write a note to Yusuf), `planner/` code that is not a pipeline
script, root config, CI.

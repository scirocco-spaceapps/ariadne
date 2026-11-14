# AI use — Ali Koray

- 2026-11-14 | A0 (no repo change) | Claude Code | ran gdalinfo over /vsicurl on the USGS DTM and ortho, started the padded crops in Docker GDAL, checked the sol 1250 position and the sol 1170-1290 range in M20_waypoints.json | read the projection, pixel size and block layout in the gdalinfo output
- 2026-11-14 | pipeline/a1-crop (merged to main directly) | Claude Code | wrote 01_crop.sh, 02_track.py, the AOI frame module, tests, and proposed moving the AOI origin 100 m south | looked at quicklook.png (track on terrain), nodata 0 % DEM / 0.009 % ortho, pipeline pytest
- 2026-11-14 | planner/a5-route (merged to main directly) | Claude Code | wrote /route and /abort on the cost grid with skimage MCP, schema-validated tests on synthetic data, Dockerfile | planner pytest, docker build and /health smoke test; not yet run on real cost data
- 2026-11-14 | contracts/aoi-origin-south (#17) | Claude Code | proposed the AOI origin 100 m south so sols 1283-1288 are inside; PR for Yusuf | checked all 58 campaign waypoints inside, contracts/check.py

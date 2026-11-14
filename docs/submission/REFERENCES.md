# References

Owner: Furkan. Every outside resource the project uses: code libraries, data, images and papers.
This feeds the "NASA Data" and "Space Agency Partner & Other Data" fields of the project page
(`page.md`). Add a row when you add a
dependency or a source.

Licences were checked on 2026-11-14 against the npm registry, PyPI and deps.dev for the versions
in the dependency files.

## Libraries — web (`web/package.json`)

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| @deck.gl/core | https://github.com/visgl/deck.gl | MIT | Map rendering engine |
| @deck.gl/layers | https://github.com/visgl/deck.gl | MIT | Raster, path and point map layers |
| @deck.gl/react | https://github.com/visgl/deck.gl | MIT | deck.gl React bindings |
| react | https://github.com/react/react | MIT | UI framework |
| react-dom | https://github.com/react/react | MIT | Rendering React in the browser |
| react-router-dom | https://github.com/remix-run/react-router | MIT | Console and cuff routes |
| uqr | https://github.com/unjs/uqr | MIT | QR code for pairing the cuff |
| zustand | https://github.com/pmndrs/zustand | MIT | Client state store |
| @testing-library/dom | https://github.com/testing-library/dom-testing-library | MIT | Web tests (dev) |
| @testing-library/react | https://github.com/testing-library/react-testing-library | MIT | Component tests (dev) |
| @types/node | https://github.com/DefinitelyTyped/DefinitelyTyped | MIT | Node type definitions (dev) |
| @types/react | https://github.com/DefinitelyTyped/DefinitelyTyped | MIT | React type definitions (dev) |
| @types/react-dom | https://github.com/DefinitelyTyped/DefinitelyTyped | MIT | React DOM type definitions (dev) |
| @vitejs/plugin-react | https://github.com/vitejs/vite-plugin-react | MIT | React support in Vite (dev) |
| jsdom | https://github.com/jsdom/jsdom | MIT | Browser environment for tests (dev) |
| openapi-typescript | https://github.com/openapi-ts/openapi-typescript | MIT | Generating web types from `contracts/openapi.yaml` (dev) |
| oxlint | https://github.com/oxc-project/oxc | MIT | Linting (dev) |
| typescript | https://github.com/microsoft/TypeScript | Apache-2.0 | Type checking and build (dev) |
| vite | https://github.com/vitejs/vite | MIT | Dev server and bundler (dev) |
| vitest | https://github.com/vitest-dev/vitest | MIT | Unit tests (dev) |
| Barlow Condensed, IBM Plex Sans, IBM Plex Mono (Google Fonts) | https://fonts.google.com/ | SIL Open Font License 1.1 | UI fonts, loaded in `web/index.html` |

## Libraries — end-to-end tests (`e2e/package.json`)

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| @playwright/test | https://github.com/microsoft/playwright | Apache-2.0 | demo90 test of console and cuff (dev) |

## Libraries — mission control (`mission-control/go.mod`)

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| github.com/gofiber/fiber/v2 | https://github.com/gofiber/fiber | MIT (includes BSD-3-Clause parts) | HTTP server, sessions and WebSocket hub |
| github.com/andybalholm/brotli | https://github.com/andybalholm/brotli | MIT | Indirect, via Fiber |
| github.com/google/uuid | https://github.com/google/uuid | BSD-3-Clause | Indirect, via Fiber |
| github.com/klauspost/compress | https://github.com/klauspost/compress | BSD-3-Clause, Apache-2.0, MIT | Indirect, via Fiber |
| github.com/mattn/go-colorable | https://github.com/mattn/go-colorable | MIT | Indirect, via Fiber |
| github.com/mattn/go-isatty | https://github.com/mattn/go-isatty | MIT | Indirect, via Fiber |
| github.com/mattn/go-runewidth | https://github.com/mattn/go-runewidth | MIT | Indirect, via Fiber |
| github.com/rivo/uniseg | https://github.com/rivo/uniseg | MIT | Indirect, via Fiber |
| github.com/valyala/bytebufferpool | https://github.com/valyala/bytebufferpool | MIT | Indirect, via Fiber |
| github.com/valyala/fasthttp | https://github.com/valyala/fasthttp | MIT | Indirect, via Fiber |
| github.com/valyala/tcplisten | https://github.com/valyala/tcplisten | MIT | Indirect, via Fiber |
| golang.org/x/sys | https://pkg.go.dev/golang.org/x/sys | BSD-3-Clause | Indirect, via Fiber |

## Libraries — Python (`contracts/`, `pipeline/`, `planner/` requirements; `notebooks/` imports)

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| jsonschema | https://github.com/python-jsonschema/jsonschema | MIT | Contract and fixture validation (`contracts/`) |
| referencing | https://github.com/python-jsonschema/referencing | MIT | Resolving schema references (`contracts/`) |
| PyYAML | https://pyyaml.org/ | MIT | Reading `openapi.yaml` (`contracts/`) |
| numpy | https://github.com/numpy/numpy | BSD-3-Clause (with 0BSD, MIT, Zlib, CC0-1.0 parts) | Raster arrays (`contracts/`, `pipeline/`) |
| Pillow | https://github.com/python-pillow/Pillow | MIT-CMU | Writing PNG map layers (`contracts/`, `pipeline/`) |
| pyproj | https://github.com/pyproj4/pyproj | MIT | Map projections (`pipeline/`) |
| rasterio | https://github.com/rasterio/rasterio | BSD-3-Clause | Reading and cropping GeoTIFFs (`pipeline/`) |
| fastapi | https://github.com/fastapi/fastapi | MIT | Planner HTTP API (`planner/`) |
| uvicorn | https://github.com/Kludex/uvicorn | BSD-3-Clause | Planner server (`planner/`) |
| pytest | https://github.com/pytest-dev/pytest | MIT | Planner tests (`planner/`, dev) |
| httpx | https://github.com/encode/httpx | BSD-3-Clause | Planner API tests (`planner/`, dev) |
| scikit-image | https://github.com/scikit-image/scikit-image | BSD License (PyPI classifier) | Minimum-cost paths: cost to home, routes and abort paths (`pipeline/`, `planner/`) |
| scipy | https://github.com/scipy/scipy | BSD License (PyPI classifier) | Viewshed notebook (`notebooks/`) |
| matplotlib | https://github.com/matplotlib/matplotlib | Matplotlib licence (PSF-based; PyPI classifier) | Validation figures (`notebooks/`) |

## Tools and hosting

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| GDAL (`gdalwarp`, `gdal_viewshed`; Docker image `ghcr.io/osgeo/gdal`) | https://github.com/OSGeo/gdal | GDAL/OGR licence, MIT-style (`LICENSE.TXT` in the repo) | Cropping and reprojecting the HiRISE mosaics (`pipeline/`), viewsheds (`notebooks/`) |
| Docker | https://www.docker.com/ | Docker Engine Apache-2.0 | Running GDAL, planner and the services |
| Caddy | https://github.com/caddyserver/caddy | Apache-2.0 | Asset server with CORS (`infra/`) |
| Tailscale Funnel | https://tailscale.com/kb/1223/funnel | Tailscale service | Public HTTPS to the services on a team laptop (`infra/funnel.sh`) |
| Vercel | https://vercel.com/ | Vercel service | Hosting the web app |
| Claude Code (Anthropic) | https://www.anthropic.com/claude-code | Anthropic service | AI coding assistant; see `docs/ai-use/` |

## NASA and USGS data

Filled in task F6 from `docs/DATA_SOURCES.md` and, for HiRISE, from the USGS pages (citation
fields copied from the USGS data-release pages on 2026-11-14; Astropedia's "Use Constraints" is
"Please cite authors"). A URL that `DATA_SOURCES.md` does not give stays TBD and is listed under
"Open questions" in `page.md`.

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| MRO HiRISE orthomosaic of Jezero, 25 cm (USGS Mars 2020 TRN), file `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif` | Product: https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-orthorectified-image-mosaic · Astropedia: https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_orthorectified_image_mosaic · File: https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif | CC0 1.0. Fergason, R. L., Galuszka, D. M., Hare, T. M., Mayer, D. P., Redding, B. L. (2020), Mars 2020 Terrain Relative Navigation HiRISE Orthorectified Image Mosaic, USGS Astrogeology Science Center data release, doi:10.5066/P9QJDP48. Source images: HiRISE. Image: NASA/JPL/University of Arizona | Base image of the site map (`ortho_50cm.jpg`, `ortho_1m.jpg`) |
| MRO HiRISE DTM mosaic of Jezero, 1 m (USGS Mars 2020 TRN), file `JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif` | Product: https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic · Astropedia: https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40 · File: https://planetarymaps.usgs.gov/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif | CC0 1.0. Fergason, R. L., Galuszka, D. M., Hare, T. M., Mayer, D. P., Redding, B. L. (2020), Mars 2020 Terrain Relative Navigation HiRISE DTM Mosaic, USGS Astrogeology Science Center data release, doi:10.5066/P9REJ9JN. Source images: HiRISE. Image: NASA/JPL/University of Arizona | Terrain, slope, walking cost, cost to home, hillshade, elevation line |
| McEwen et al. 2007, Mars Reconnaissance Orbiter's High Resolution Imaging Science Experiment (HiRISE), J. Geophys. Res. 112, E05S04 | https://doi.org/10.1029/2005JE002605 | Citation (listed in the references of both Astropedia pages) | Instrument reference for the HiRISE mosaics |
| Fergason et al. 2020, Mars 2020 Terrain Relative Navigation Flight Product Generation: Digital Terrain Model and Orthorectified Image Mosaics, 51st LPSC | https://www.hou.usra.edu/meetings/lpsc2020/pdf/2020.pdf | Citation (listed in the references of both Astropedia pages) | How the HiRISE mosaics were made |
| MRO CTX DTM, 20 m (USGS) | — | — | **Not used (backup).** The HiRISE DTM had 0 % gaps in our area |
| Mars 2020 traverse (`M20_traverse.json`) | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json | NASA/JPL-Caltech (MMGIS) | Rover track layer; slope and route checks |
| Mars 2020 waypoints (`M20_waypoints.json`) | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json | NASA/JPL-Caltech (MMGIS) | Stop and safe-haven positions, sols, viewshed observer points |
| Mars 2020 raw images, Navcam and Mastcam-Z | https://mars.nasa.gov/mars2020/multimedia/raw-images/ | NASA/JPL-Caltech/ASU (Mastcam-Z) | Stop photos; each image is listed under "Stop photos" below |
| Mars 2020 MEDA, `CAL_ATS` and `DER_PS` for sol 1215 (NASA PDS Atmospheres Node) | https://doi.org/10.17189/1522849 | NASA PDS dataset doi:10.17189/1522849 | Conditions panel: air temperature, pressure (dust opacity not available) |
| MSL RAD surface dose rate (Hassler et al. 2014, Science 343, 1244797) | https://doi.org/10.1126/science.1244797 | Citation | Modeled radiation dose rate |
| DONKI WSA-ENLIL CME arrival forecasts for Mars (CCMC, via api.nasa.gov) | TBD (the app links https://kauai.ccmc.gsfc.nasa.gov/DONKI/; no row in `DATA_SOURCES.md` yet) | NASA CCMC | Space-weather list in the conditions panel, live mode only |
| USGS SIM 3464, Jezero crater geologic map | — | — | **Not used.** No geology layer is published (`geology.geojson` is optional and absent) |

## Stop photos (`content/photos/`)

Perseverance raw images, Mastcam-Z right camera, NASA's 1200 px JPG browse version. The credit is
copied from NASA's raw-image record of each image.

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| `mount-washburn_1.jpg`, sol 1164 (ZR0_1164_0770274620_848EBY_N0524312ZCAM03910_1100LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1164_0770274620_848EBY_N0524312ZCAM03910_1100LMJ | NASA/JPL-Caltech/ASU | Stop card `mount-washburn` |
| `mount-washburn_2.jpg`, sol 1164 (ZR0_1164_0770275801_910EBY_N0524312ZCAM03911_0340LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1164_0770275801_910EBY_N0524312ZCAM03911_0340LMJ | NASA/JPL-Caltech/ASU | Stop card `mount-washburn` |
| `tuff-cliff_1.jpg`, sol 1169 (ZR0_1169_0770718530_081EBY_N0525032ZCAM09207_1100LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1169_0770718530_081EBY_N0525032ZCAM09207_1100LMJ | NASA/JPL-Caltech/ASU | Stop card `tuff-cliff` |
| `tuff-cliff_2.jpg`, sol 1170 (ZR0_1170_0770805868_988EBY_N0525032ZCAM09208_0630LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1170_0770805868_988EBY_N0525032ZCAM09208_0630LMJ | NASA/JPL-Caltech/ASU | Stop card `tuff-cliff` |
| `bright-angel_1.jpg`, sol 1176 (ZR0_1176_0771341345_098EBY_N0530000ZCAM09216_0630LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1176_0771341345_098EBY_N0530000ZCAM09216_0630LMJ | NASA/JPL-Caltech/ASU | Stop card `bright-angel` |
| `bright-angel_2.jpg`, sol 1176 (ZR0_1176_0771341966_098EBY_N0530000ZCAM09216_0630LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1176_0771341966_098EBY_N0530000ZCAM09216_0630LMJ | NASA/JPL-Caltech/ASU | Stop card `bright-angel` |
| `cheyava-falls_1.jpg`, sol 1217 (ZR0_1217_0774980023_770EBY_N0560000ZCAM09264_1100LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1217_0774980023_770EBY_N0560000ZCAM09264_1100LMJ | NASA/JPL-Caltech/ASU | Stop card `cheyava-falls` |
| `cheyava-falls_2.jpg`, sol 1217 (ZR0_1217_0774980058_772EBY_N0560000ZCAM09264_1100LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1217_0774980058_772EBY_N0560000ZCAM09264_1100LMJ | NASA/JPL-Caltech/ASU | Stop card `cheyava-falls` |
| `masonic-temple_1.jpg`, sol 1240 (ZR0_1240_0777023997_598EBY_N0563438ZCAM09297_1100LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1240_0777023997_598EBY_N0563438ZCAM09297_1100LMJ | NASA/JPL-Caltech/ASU | Stop card `masonic-temple` |
| `masonic-temple_2.jpg`, sol 1233 (ZR0_1233_0776404196_640EBY_N0563438ZCAM09285_0630LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1233_0776404196_640EBY_N0563438ZCAM09285_0630LMJ | NASA/JPL-Caltech/ASU | Stop card `masonic-temple` |

## Stop science sources (`content/stops/`)

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| NASA's Perseverance Fords an Ancient River to Reach Science Target (NASA/JPL, 13 June 2024) | https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-fords-an-ancient-river-to-reach-science-target/ | NASA/JPL-Caltech | Science questions and tasks: Mount Washburn, Tuff Cliff, Bright Angel |
| NASA's Perseverance Rover Scientists Find Intriguing Mars Rock (NASA/JPL, 25 July 2024) | https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-rover-scientists-find-intriguing-mars-rock/ | NASA/JPL-Caltech | Science question and tasks: Cheyava Falls |
| Hurowitz et al. 2025, Redox-driven mineral and organic associations in Jezero Crater, Mars, Nature | https://doi.org/10.1038/s41586-025-09413-0 | Nature (citation) | Units, tasks and photo captions: Bright Angel, Cheyava Falls, Masonic Temple |
| Jones et al. 2025, A fluvio-lacustrine environment preserved in the Jezero crater inlet channel, Neretva Vallis (Mars), EPSC-DPS 2025 abstract EPSC-DPS2025-888 | https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-888.html | © Author(s) 2025, CC BY 4.0 | Tuff Cliff member and lake reading (Tuff Cliff); Bright Angel younger than the Margin unit (Bright Angel) |

## Target photos (`content/photos/target-*`)

Perseverance raw images, NASA's 1200 px JPG browse version. The credit is copied from NASA's raw-image record.

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| `target-cheyava-falls_1.jpg`, sol 1206 (NLF_1206_0774007545_050ECM_N0550340NCAM02206_01_195J) | https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_1206_0774007545_050ECM_N0550340NCAM02206_01_195J | NASA/JPL-Caltech | Target card `target-cheyava-falls` |
| `target-cheyava-falls_2.jpg`, sol 1195 (NLF_1195_0773024714_972ECM_N0550000NCAM02195_01_195J) | https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_1195_0773024714_972ECM_N0550000NCAM02195_01_195J | NASA/JPL-Caltech | Target card `target-cheyava-falls` |
| `target-masonic-temple_1.jpg`, sol 1234 (ZR0_1234_0776498919_659EBY_N0563438ZCAM09289_1100LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1234_0776498919_659EBY_N0563438ZCAM09289_1100LMJ | NASA/JPL-Caltech/ASU | Target card `target-masonic-temple` |
| `target-masonic-temple_2.jpg`, sol 1232 (NLF_1232_0776303089_566ECM_N0563438NCAM15231_01_195J) | https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_1232_0776303089_566ECM_N0563438NCAM15231_01_195J | NASA/JPL-Caltech | Target card `target-masonic-temple` |
| `target-mount-washburn_1.jpg`, sol 1170 (NLF_1170_0770822521_176ECM_N0525844NCAM02170_04_195J) | https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_1170_0770822521_176ECM_N0525844NCAM02170_04_195J | NASA/JPL-Caltech | Target card `target-mount-washburn` |
| `target-mount-washburn_2.jpg`, sol 1163 (NLF_1163_0770179205_159ECM_N0524312NCAM14162_04_195J) | https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_1163_0770179205_159ECM_N0524312NCAM14162_04_195J | NASA/JPL-Caltech | Target card `target-mount-washburn` |
| `target-closest-pass_1.jpg`, sol 1159 (ZR0_1159_0769818090_473EBY_N0523018ZCAM09196_0630LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1159_0769818090_473EBY_N0523018ZCAM09196_0630LMJ | NASA/JPL-Caltech/ASU | Target card `target-closest-pass` |
| `target-closest-pass_2.jpg`, sol 1155 (ZR0_1155_0769468610_818EBY_N0522644ZCAM09193_0480LMJ) | https://mars.nasa.gov/mars2020/multimedia/raw-images/ZR0_1155_0769468610_818EBY_N0522644ZCAM09193_0480LMJ | NASA/JPL-Caltech/ASU | Target card `target-closest-pass` |

## Target sources (`content/stops/target-*`)

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| Ariadne B3 viewshed notebook, Chosen targets table (Bunyamin) | https://github.com/scirocco-spaceapps/ariadne/blob/main/notebooks/viewshed.ipynb | Project work | Target choice, distances, sols, slope and science questions |
| Mars 2020 raw image API (camera model, rover attitude) | https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json | NASA/JPL-Caltech | Checking that each target photo points at its target |
| Mars 2020 waypoints (`M20_waypoints.json`) | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json | NASA/JPL-Caltech | Rover positions and headings for the target photos |
| Ariadne walk model parameters (`model/params.json`: caution_slope_deg 15, max_slope_deg 20) | https://github.com/scirocco-spaceapps/ariadne/blob/main/model/params.json | Project work (Bunyamin) | Slope class in the `target-closest-pass` task |

## Walk model sources (`model/params.json`)

Copied from the `source` fields of `model/params.json` (Bunyamin, B1). `docs/model.md` lists which
of them are not yet checked against the original.

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| Scoville, Artemis III EVA Mission Capability for de Gerlache-Shackleton Ridge (quotes the xEVA System Requirements Document and Del Greco et al. 2021) | https://ntrs.nasa.gov/citations/20210026296 | NASA NTRS | `max_slope_deg` 20, `walk_speed_flat_m_per_min` 33.3, `budget_min`, `reserve_min` |
| Oliver et al., ICES 2026, Mars PLSS design study | https://ntrs.nasa.gov/citations/20260005204 | NASA NTRS | `budget_min` 360, `reserve_min` 60 |
| Apollo 15 Activities Timeline (Lunar Orbital Data Explorer, WUSTL) | https://an.rsl.wustl.edu/apollo/data/A15/pages/time/time.html | Washington University in St. Louis | `dwell_min` 20 |
| Tobler 1993, Three presentations on geographical analysis and modeling, NCGIA Technical Report 93-1 | TBD | Citation, not yet checked | `speed_vs_slope` |
| Hassler et al. 2014, Mars' surface radiation environment measured with the Mars Science Laboratory's Curiosity rover, Science 343, 1244797 | https://doi.org/10.1126/science.1244797 | Citation | `radiation_dose_rate` 210 uGy/day |
| Bell et al. 2021, The Mars 2020 Perseverance Rover Mast Camera Zoom (Mastcam-Z), Space Sci. Rev. 217:24 | https://doi.org/10.1007/s11214-020-00755-x | Citation | `observer_height_m` 2.0 |

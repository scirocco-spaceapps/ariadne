# References

Owner: Furkan. Every outside resource the project uses: code libraries, data, images and papers.
This feeds the "Other References" field of the project page (`page.md`). Add a row when you add a
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

## Libraries — Python (`contracts/`, `pipeline/`, `planner/` requirements)

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

## NASA and USGS data (planned)

`docs/DATA_SOURCES.md` has no NASA or USGS rows yet. These rows come from the data table in the
game plan and are not confirmed. Fill in URL and credit when the source is added to
`docs/DATA_SOURCES.md` (cards A1, B1, B4, F3), and remove any row the project does not use.

| Resource | URL | Licence or credit | Used for |
|---|---|---|---|
| MRO HiRISE orthomosaic of Jezero, 25 cm (USGS) | TBD | TBD | Base image of the site map |
| MRO HiRISE DTM mosaic of Jezero, 1 m (USGS) | TBD | TBD | Terrain, slope and walking cost |
| MRO CTX DTM, 20 m (USGS) | TBD | TBD | Backup terrain model if the HiRISE DTM has gaps |
| Mars 2020 traverse and waypoints (`M20_traverse.json`, `M20_waypoints.json`) | TBD | TBD | Rover track, site location and sols |
| Mars 2020 raw images, Navcam and Mastcam-Z | https://mars.nasa.gov/mars2020/multimedia/raw-images/ | NASA/JPL-Caltech/ASU (Mastcam-Z) | Stop photos; each image is listed under "Stop photos" below |
| Mars 2020 MEDA weather data (NASA PDS) | TBD | TBD | Conditions panel: temperature, pressure, dust |
| MSL RAD surface dose rate (Hassler et al. 2014) | TBD | TBD | Modeled radiation dose rate |
| DONKI WSA-ENLIL CME arrival forecasts (api.nasa.gov) | TBD | TBD | Storm arrival forecast |
| USGS SIM 3464, Jezero crater geologic map | TBD | TBD | Geology layer |

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

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
| Mars 2020 raw images, Navcam and Mastcam-Z | TBD | TBD | Stop photos |
| Mars 2020 MEDA weather data (NASA PDS) | TBD | TBD | Conditions panel: temperature, pressure, dust |
| MSL RAD surface dose rate (Hassler et al. 2014) | TBD | TBD | Modeled radiation dose rate |
| DONKI WSA-ENLIL CME arrival forecasts (api.nasa.gov) | TBD | TBD | Storm arrival forecast |
| USGS SIM 3464, Jezero crater geologic map | TBD | TBD | Geology layer |

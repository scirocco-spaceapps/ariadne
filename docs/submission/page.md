# Ariadne — Space Apps project page

Owner: Furkan. Draft of the NASA Space Apps 2026 project form (task F6). One heading per field of
the **live** form, in the form's order. Paste the text under each heading into its field; the HTML
comments are notes for us and are not pasted. English. Every number links to a row in
`docs/DATA_SOURCES.md` or a table in `docs/validation.md`; every outside resource is in
[`REFERENCES.md`](REFERENCES.md).

## Project Name

<!-- Form: text. -->

Ariadne

## Summary

<!-- Form: 50-200 words, at most 1500 characters. Already saved on the site; this text replaces it.
Count of the text below (checked with a script): 158 words, 846 characters (paragraphs
joined with one blank line). -->

Ariadne is a walking-scale Mars EVA map for Bright Angel in Jezero crater. It layers NASA data,
plans a science walk, and shows at every moment whether the astronaut can still get back to the
safe haven. It is for the people who plan a walk on Mars: the team at the mission console, and the
astronaut, who sees the same clock on a phone worn as a wrist cuff. On Mars, every walk needs a way
back.

We turned NASA HiRISE images and terrain of Jezero into slope, walking cost and minutes to home.
The stops are places Perseverance studied, with its photos. As time passes, the map shrinks to the
ground the astronaut can still reach and get back from. In our demo, a simulated storm alert sends
both screens the way home. Every value carries its provenance. The walk model uses lunar EVA
planning values, so it is a planning aid, not a safety tool.

## Project Demonstration

<!-- Form: URL of the 30 s video. Made in task F7. -->

TBD (F7: 30-second video)

## Project

<!-- Form: one public URL. Decision (Furkan, 2026-11-14): the repo. It is PRIVATE today and has no
licence file; Yusuf makes it public (Y8 in docs/TASKS.md). Check the link in a private window
before submitting. The live site goes inside Project Details. -->

https://github.com/scirocco-spaceapps/ariadne

## Project Details

<!-- Form: one rich-text field. It asks: what it does and how it works, benefits, intended impact,
tools/languages/hardware/software, how it is creative, what factors the team considered. Paste
everything from "What it does" to the end of "How we used AI". -->

### What it does

Ariadne plans a science walk for an astronaut on Mars and keeps the way home in view for the whole
walk. Our site is a 2.5 x 2 km area around Bright Angel in Jezero crater, where Perseverance found
the Cheyava Falls rock.

There are two screens:

- **Mission console** (laptop). A map of the site with layers you can switch on and off: the HiRISE
  orthoimage, hillshade, slope, go / caution / no-go ground, Perseverance's track and waypoints,
  the planned route, the stops and the safe haven. A route table lists each leg with distance,
  walking time and the time left. A time bar runs the walk. Stop cards show the science question,
  tasks and Perseverance photos with their credit lines. A conditions panel shows weather,
  radiation and space weather.
- **Cuff** (a phone worn on the wrist, paired by QR code). It shows the margin to home in minutes,
  the consumables left, the next stop and its card, and the storm-alert screen. Both screens share
  one clock.

The **return envelope** colours every part of the map: home with the reserve and time to spare,
home with the reserve but little to spare, or no way home without using the reserve. It shrinks as
the walk goes on. A toggle shows the same envelope on flat ground, so you can see what the terrain
changes. A "seen, not touched" layer marks ground that Perseverance's cameras saw but the rover
never drove to. Four targets on it have their own cards.

When the operator raises a storm alert, the console draws the way home ("the thread"), and the
cuff switches to "Follow the thread home". After the all-clear, the plan goes on.

Live site: https://ariadne-gilt-tau.vercel.app. Its services run on a team laptop, so the site can
be offline at times.

### How it works

1. **Pipeline (Python, GDAL).** It crops the USGS HiRISE orthomosaic (25 cm) and DTM (1 m) to our
   area. Slope is computed on the 1 m DTM with Horn's method; a 2 m cell takes the mean of its four
   1 m slopes. Cells above 20° are no-go; 15–20° is caution. Walking speed is 2 km/h on flat
   ground and drops with slope. One shortest-path run from the safe haven gives the minutes home
   from every 2 m cell.
2. **Planner (Python, FastAPI).** `/route` finds the least-cost path through the stops. `/abort`
   finds the path home from any point.
3. **Mission control (Go, Fiber).** It runs the walk simulation and streams the state to both
   screens over WebSocket, twice a second. It also serves the conditions: Mars 2020 MEDA weather
   for sol 1215 (archive), a radiation value, and NASA DONKI CME arrival forecasts for Mars (live).
4. **Web (TypeScript, React, deck.gl).** The console and the cuff. The envelope is computed in the
   browser: margin = budget − elapsed time − reserve − minutes home.

All positions are metres on a local plane. Every value on screen has a provenance label:
Observed, Derived, Modeled, Assumed or Simulation.

On the real data (Modeled unless noted):

- The planned walk from the safe haven through the five stops and back is 2.89 km: 119.7 min of
  walking plus 100 min at the stops, 219.7 min in all. That leaves 80.3 min before the 60 min
  reserve in a 360 min EVA.
- 52.0 % of the area is within 75 min of the safe haven over the real terrain. On flat ground it
  would be 94.4 %.
- Along 4.51 km of Perseverance's own track, 1.6 % is steeper than our 20° limit (Derived). A rover
  is not a human, so this is a sanity check, not proof of safety.
- Between Tuff Cliff and Bright Angel our planned leg is 581 m; the rover drove 582 m.

The demo video uses the app's **DEMO replay**. That is **SYNTHETIC** data, marked "DEMO DATA" on
screen. Its storm alert is **simulated**. DONKI forecasts appear in the conditions panel in live
mode only; they never raise the alert.

<!-- SCIENCE PLACEHOLDER — docs/submission/science.md (Bunyamin, task B5, Sunday ~09:30).
Not written yet. Do not fill this from other docs. Paste Bunyamin's text here when it lands. -->

**Science:** _placeholder, to come from `docs/submission/science.md` (B5)._

### Benefits

- An EVA team could see, before the walk, what each stop costs in time and how much margin is left.
- During the walk, the crew and the ground see the same picture: where the astronaut can still go
  and still get home.
- If something goes wrong, the way home is already on the map.

### Intended impact

Ariadne is a first step toward planning tools for human walks on the Moon and Mars. It shows how
open NASA orbital data, rover data and EVA planning values can be combined into one decision: can
we still get home from here?

### Tools, languages, hardware and software

- Languages: Python, Go, TypeScript.
- Data: GDAL, rasterio, pyproj, numpy, scikit-image, scipy, matplotlib.
- Services: FastAPI and uvicorn (planner), Fiber (mission control), WebSocket.
- Web: React, deck.gl, Vite, zustand, uqr (QR code).
- Tests: pytest, Go test, Vitest, Playwright (end-to-end test of both screens through the storm
  alert).
- Hosting: Vercel (web), Docker, Caddy and Tailscale Funnel on a team laptop (services).
- Hardware: a laptop for the console, a phone for the cuff.
- AI: Claude Code (see "How we used AI").

### How it is creative

- **A thread home.** One shortest-path run from the safe haven gives the minutes home from every
  point. The map turns that into one question you can read at a glance: can I still go there and
  get back?
- **Seen, not touched.** We mark ground Perseverance's cameras saw but it never drove to. These are
  places a human geologist could walk to.
- **Same picture on two screens.** The console and the wrist cuff run on one clock.

### Factors we considered

- **Provenance.** Every value carries Observed, Derived, Modeled, Assumed or Simulation. A value
  without a source is Assumed.
- **Lunar values on Mars.** The 20° slope limit, the 2 km/h walking speed, the 360 min EVA and
  the 60 min reserve come from NASA lunar EVA and suit planning documents. No suited walking on
  Mars exists to check them against. They are labelled Assumed.
- **The model is simple.** Cost depends on slope only, the same uphill and downhill. Sand and rock
  fields are not in it. The speed curve comes from Earth hikers (Tobler 1993).
- **A rover is not a human.** We checked our slopes and routes against Perseverance's drives, as a
  sanity check only.
- **Data limits.** The DTM has striping in the west of the area. Radiation is a value measured by
  Curiosity at Gale crater, not at Jezero. MEDA has no dust opacity product, so that value is empty.
- **No invented data.** We looked for a partner-agency dust value we could fetch without a login
  and found none, so that slot stays empty and says why.
- **Synthetic data stays labelled.** The DEMO replay and test fixtures say SYNTHETIC on screen.
- **Credits.** Every photo shows its credit line. No NASA logos, no mission patches, no
  AI-generated images.

### How we used AI

All six team members used Claude Code (Anthropic), an AI coding assistant. We used it to plan each
task, to find and quote sources, to write code, tests, data-processing scripts and notebooks, to
debug, and to draft the docs, the stop cards, this page and the video script. The UI theme and our
visual brief were drafted with it. A team member approved each plan and checked each result. We
logged one line per task in `docs/ai-use/`, and every AI-assisted commit names Claude as
co-author. We used no AI-generated images. AI produced no measurements: every value comes from a
cited source or is marked Assumed. Some checks are still open: three citations in the walk model
have not been checked against the originals yet, and some tests (a race-detector run, the cuff on
a real phone at arm's length) were not done.

## Use of Super Intelligence (SI)

<!-- Form: multi-select checkboxes. Judges do NOT see this field; they see the "How we used AI"
paragraph in Project Details. Evidence: docs/ai-use/*.md (one line per task). -->

| Box | Tick | Why (from `docs/ai-use/`) |
|---|---|---|
| Ideation or Brainstorming | ✔ | Contract defaults decided with Claude at the team's request (yusuf.md, contracts/v1); three video script variants (furkan.md, F5); safe-haven candidates ranked (bunyamin.md, B2) |
| Research or Information Gathering | ✔ | Sources found and quoted for every walk-model parameter (bunyamin.md, B1); MEDA files found on PDS (B4); partner-data search in ESA PSA, EMM SDC and Zenodo (mazlum.md, M6); ~690 raw images screened (furkan.md, F3) |
| Data Analysis and Interpretation | ✔ | HiRISE crop, slope, cost and cost-to-home scripts (alikoray.md); viewshed and validation notebooks (bunyamin.md, B3, B4); target photos checked with the NASA camera model (furkan.md, F3) |
| Building SI/ML Into the Project | — | The app has no AI or ML; all of its logic is plain code |
| Coding, Debugging, or Troubleshooting | ✔ | Every service and the web app (all six files); CI failures diagnosed (yusuf.md #25, alikoray.md #24) |
| Writing, Editing, or Translation | ✔ | docs/model.md, validation.md, stop and target cards, this page (bunyamin.md, furkan.md) |
| Visual Design or Image Creation | ✔ | UI theme and visual brief drafted with Claude; no AI-generated images (nuri.md, web/n6-console) |
| Presentation, Video, or Audio | ✔ | 30 s video script and shot list (furkan.md, F5) |
| Other Project-Related SI Use | ✔ | Planning each task in plan mode before any code; contract reviews and PR checks (yusuf.md, pr-ac) |
| None / Did not use SI or SI tools | — | We used SI |

## NASA Data

<!-- Form: list of "Link Text | Link Url" pairs. Paste the first two columns. The third column is
for us and for Project Details. -->

| Link Text | Link Url | What it changes in the app |
|---|---|---|
| MRO HiRISE, Mars 2020 TRN HiRISE Orthorectified Image Mosaic, 25 cm (USGS) | https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-orthorectified-image-mosaic | Base map of the site (orthoimage layer, Observed) |
| MRO HiRISE, Mars 2020 TRN HiRISE DTM Mosaic, 1 m (USGS) | https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic | Slope, go / caution / no-go, walking cost, minutes home, return envelope, route times, hillshade, elevation line |
| Mars 2020, rover traverse (MMGIS `M20_traverse.json`) | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json | Rover track layer; slope and route checks against the real drive |
| Mars 2020, rover waypoints (MMGIS `M20_waypoints.json`) | https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json | Positions of the five stops and the safe haven; viewshed observer points; DEM height check |
| Mars 2020, Mastcam-Z and Navcam raw images | https://mars.nasa.gov/mars2020/multimedia/raw-images/ | Photos on the stop and target cards |
| Mars 2020, raw image API (camera model, rover attitude) | https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json | Checking that each target photo points at its target |
| Mars 2020, MEDA calibrated air temperature and derived pressure (NASA PDS Atmospheres Node) | https://doi.org/10.17189/1522849 | Weather in the conditions panel: sol 1215, archive, Derived |
| MSL, RAD surface dose rate at Gale crater (Hassler et al. 2014) | TBD (open question) | Radiation value in the conditions panel (Modeled for Jezero) |
| NASA DONKI, WSA-ENLIL CME arrival forecasts for Mars (CCMC) | TBD (open question; the app links https://kauai.ccmc.gsfc.nasa.gov/DONKI/) | Space-weather list in the conditions panel, live mode only; it does not raise the demo alert |
| NASA NTRS 20210026296, Artemis III EVA mission capability (Scoville), quoting the xEVA requirements | https://ntrs.nasa.gov/citations/20210026296 | 20° slope limit, 2 km/h walking speed, 1 h contingency |
| NASA NTRS 20260005204, Mars PLSS design study (Oliver et al., ICES 2026) | https://ntrs.nasa.gov/citations/20260005204 | 360 min EVA budget, 60 min reserve |
| Apollo 15 Activities Timeline (Lunar Orbital Data Explorer, WUSTL) | https://an.rsl.wustl.edu/apollo/data/A15/pages/time/time.html | 20 min at each stop (median of nine Apollo 15 geology stations) |
| NASA/JPL, Perseverance fords an ancient river to reach science target (13 June 2024) | https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-fords-an-ancient-river-to-reach-science-target/ | Science questions and tasks: Mount Washburn, Tuff Cliff, Bright Angel |
| NASA/JPL, Perseverance rover scientists find intriguing Mars rock (25 July 2024) | https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-rover-scientists-find-intriguing-mars-rock/ | Science question and tasks: Cheyava Falls |

<!-- Not used, so not listed: MRO CTX DTM (backup only; the HiRISE DTM had 0 % gaps), USGS SIM 3464
geologic map (no geology layer is published), THEMIS (cut in F1). -->

## Space Agency Partner & Other Data

<!-- Form: list of "Link Text | Link Url" pairs. The form asks for all code, text, images and tools
used, open source included. The full list with licences is REFERENCES.md. -->

We used no data from a space agency partner. We looked for a partner dust value we could fetch
without a login (EMM Hope science data centre, ESA PSA for Mars Express, open copies on Zenodo)
and found none, so that panel stays empty and says why.

| Link Text | Link Url |
|---|---|
| Ariadne full reference list: data, papers, photos, libraries and licences | https://github.com/scirocco-spaceapps/ariadne/blob/main/docs/submission/REFERENCES.md |
| Fergason et al. 2020, Mars 2020 TRN HiRISE Orthorectified Image Mosaic, USGS data release (CC0 1.0) | https://doi.org/10.5066/P9QJDP48 |
| Fergason et al. 2020, Mars 2020 TRN HiRISE DTM Mosaic, USGS data release (CC0 1.0) | https://doi.org/10.5066/P9REJ9JN |
| McEwen et al. 2007, Mars Reconnaissance Orbiter's High Resolution Imaging Science Experiment (HiRISE), JGR 112, E05S04 | https://doi.org/10.1029/2005JE002605 |
| Hurowitz et al. 2025, Redox-driven mineral and organic associations in Jezero Crater, Mars, Nature | https://doi.org/10.1038/s41586-025-09413-0 |
| Jones et al. 2025, A fluvio-lacustrine environment preserved in the Jezero crater inlet channel, Neretva Vallis, EPSC-DPS 2025 | https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-888.html |
| Bell et al. 2021, The Mars 2020 Perseverance Rover Mast Camera Zoom (Mastcam-Z), Space Sci. Rev. 217:24 | https://doi.org/10.1007/s11214-020-00755-x |
| Tobler 1993, Three presentations on geographical analysis and modeling, NCGIA Technical Report 93-1 | TBD (open question) |
| GDAL | https://github.com/OSGeo/gdal |
| rasterio | https://github.com/rasterio/rasterio |
| pyproj | https://github.com/pyproj4/pyproj |
| numpy | https://github.com/numpy/numpy |
| scikit-image | https://github.com/scikit-image/scikit-image |
| scipy | https://github.com/scipy/scipy |
| matplotlib | https://github.com/matplotlib/matplotlib |
| FastAPI | https://github.com/fastapi/fastapi |
| Fiber | https://github.com/gofiber/fiber |
| React | https://github.com/react/react |
| deck.gl | https://github.com/visgl/deck.gl |
| Vite | https://github.com/vitejs/vite |
| zustand | https://github.com/pmndrs/zustand |
| uqr | https://github.com/unjs/uqr |
| Playwright | https://github.com/microsoft/playwright |
| IBM Plex Sans, IBM Plex Mono, Barlow Condensed (Google Fonts) | https://fonts.google.com/ |
| Claude Code (Anthropic), AI coding assistant | https://www.anthropic.com/claude-code |
| Vercel (web hosting) | https://vercel.com/ |
| Tailscale Funnel (service hosting from a team laptop) | https://tailscale.com/kb/1223/funnel |
| Caddy (asset server) | https://github.com/caddyserver/caddy |
| Docker | https://www.docker.com/ |

## Open questions

Everything I was unsure about while writing this page (F6, 2026-11-14):

1. **Repo is private.** The Project link works only after Yusuf makes the repo public (Y8). It has
   no licence file yet either. The REFERENCES.md link in the table above also needs the public repo.
2. **Science section is a placeholder.** `science.md` is empty (Bunyamin, B5, Sunday ~09:30).
3. **MSL RAD URL.** Neither `DATA_SOURCES.md` nor `model/params.json` has a URL for Hassler et al.
   2014 (Science 343, 1244797). The DOI would be the natural link; someone should confirm it and add
   it to `DATA_SOURCES.md`. `docs/model.md` also says the value was read from a copy of the paper.
4. **DONKI has no row in `DATA_SOURCES.md`.** The app links https://kauai.ccmc.gsfc.nasa.gov/DONKI/
   (mission-control). Note left for Yusuf, who took over Mazlum's card.
5. **Tobler 1993 has no URL.** `docs/model.md` says the citation was written from memory.
6. **HiRISE credit line.** The USGS pages give citations and "Please cite authors", but no credit
   line. "NASA/JPL-Caltech/University of Arizona" comes from Ali Koray's note, not from those
   pages. The USGS product page and Astropedia also differ on author order and date (Astropedia
   lists nine authors of an LPSC 2020 abstract and a 2020-07-24 date; the data release lists five
   authors and 6 August 2020). I used the data-release citation.
7. **Live site.** It depends on Nuri's laptop. On 2026-11-14 at about 19:00 the services and the
   real assets answered; the HiRISE layer in the browser was not checked by me.
8. **NTRS and Apollo rows under NASA Data.** They are NASA documents and Apollo data, not Mars
   datasets. If the judges expect datasets only, move them to the other list.
9. **Stop science text.** The stop cards cite NASA news pages and papers, and Bunyamin reviewed
   them (F3), but the science write-up itself is not done (see 2).
10. **Summary numbers.** The Summary has no numbers on purpose; if you want one, the 2.89 km /
    80.3 min margin is the safest (Modeled, `DATA_SOURCES.md` row of the planned walk).
11. **MPC replanning.** Not described here: it is not merged yet (TASKS.md, MPC-2). Add one line
    only if it lands before Sunday 09:30 and shows in the demo.

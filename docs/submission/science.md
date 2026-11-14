# Science write-up

Owner: Bunyamin (task B5; the replanning paragraph is task MPC-3).

**How to use this page.** Section 1 is the text for the "Science" placeholder in
[`page.md`](page.md) (Project Details). The other sections stay here as the full write-up. Every
number comes from a row in [`docs/DATA_SOURCES.md`](../DATA_SOURCES.md), from
[`docs/model.md`](../model.md), from [`docs/validation.md`](../validation.md) or from a file in
`notebooks/out/`. Provenance labels are the app's: Observed, Derived, Modeled, Assumed,
Simulation.

## 1. For page.md

<!-- Paste from "Science." to the end of this section. -->

**Science.** Bright Angel, on the northern edge of Neretva Vallis in Jezero crater, is where
Perseverance found Cheyava Falls. This reddish mudstone has millimetre-size "leopard spots", and
the rover took its Sapphire Canyon core from it on about sol 1215 (NASA, July 2024; Hurowitz et
al. 2025, Nature). Did these spots form through chemistry that microbes could have used for
energy, or without life? A rover found the clue. A geologist on foot could go back to test it.

Our walk follows Perseverance's own stops, in the rover's order: Mount Washburn, Tuff Cliff, Bright
Angel, Cheyava Falls and Masonic Temple. Each stop card asks one science question from the NASA
pages and papers, and lists the tasks a human would do there: the contact between two rock units,
layer thicknesses with a scale bar, close-ups of the spots and veins. We also mapped ground that the
rover's cameras saw but the rover never drove to. Four targets there are 22–46 min from the safe
haven.

The walk model answers a planner's first question: does the walk fit, and how much is left over?
The walk is 2.89 km: 119.7 min of walking plus 100 min at the stops, which leaves 80.3 min before
the 60 min reserve (Modeled). It cannot say how a suited astronaut walks on Mars. No one has done
it yet, so the speed, the slope limit and the EVA length come from lunar requirements and a Mars
suit design study (Assumed). If a what-if suit leak or a dust storm cuts the time, the console
suggests the smallest change that still gets the astronaut home with the reserve intact: shorter
stops first, then skipping a stop. The crew decides.

## 2. Why Bright Angel

Cheyava Falls holds the Sapphire Canyon core: the strongest candidate for a sign of ancient life
that Perseverance has found (NASA, 25 July 2024; Hurowitz et al. 2025). The rocks around it belong
to the Bright Angel formation. Jones et al. (2025) read this formation as lake and river deposits
in the Neretva Vallis inlet channel. The rover's route through it gives us everything inside one
2.5 × 2 km area:

- real stops,
- real photos,
- a real traverse to check the walk model against.

## 3. The stops and their questions

The stops are the places where Perseverance ended its drive on the sol it arrived. The questions
are shortened from the stop cards (`content/stops/<id>.json`); each card cites its sources.
Arrival times are on the planned walk from the safe haven (`notebooks/out/route.json`, Modeled).

| Stop | Rover sol | Science question | Arrival on the plan |
|---|---|---|---|
| Mount Washburn | 1162 | Some boulders here are of a type never seen before on Mars. Did they come down from the crater rim, or did water carry them in from beyond Jezero? | 22.6 min |
| Tuff Cliff | 1168 | Do these thin, planar layers with pebbles, at the base of the Bright Angel formation, record the start of the lake? | 47.5 min |
| Bright Angel | 1175 | The light-toned rocks sit in the channel below the Margin unit. Are they younger than it, and where exactly is the contact? | 88.2 min |
| Cheyava Falls | 1210 (core on about 1215) | Do the "leopard spots" record chemical reactions that microbes could have used for energy, or did they form without life? | 115.2 min |
| Masonic Temple | 1231 (inferred) | Same formation, but redder, and its abraded patch Malgosa Crest showed no organic-carbon signal. Why is this side of the valley different? | 152.4 min |

- **Masonic Temple's sol is inferred.** It comes from the Malgosa Crest abrasion on sol 1242
  (Hurowitz et al. 2025). No NASA news page names the stop.
- **Each stop gets 20 min** (`dwell_min`). That is the median time at the nine Apollo 15 geology
  stations (Derived).

## 4. Seen, not touched

A rover sees far more ground than it drives over. We computed what Perseverance's cameras could see
from its waypoints:

- **Viewsheds:** computed on the HiRISE 1 m terrain, from a camera height of 2.0 m (Mastcam-Z).
- **Area kept:** ground within 150 m of a waypoint.
- **Area removed:** everything within 10 m of the track.
- **Ranking:** the rest was split into 50 m tiles and ranked (`notebooks/viewshed.ipynb`).

Four targets became cards (Derived):

| Target | Where | Question |
|---|---|---|
| Near Cheyava Falls | 79 m away | Do the layers with "leopard spots" continue beyond the sampled rock? |
| Near Masonic Temple | 52 m away, channel's south side | Are these strata the same as Bright Angel's? |
| Near Mount Washburn | 127 m away, about 3° slope | Do the unusual boulders lie here too? |
| Closest pass | the rover stopped 24 m away on sol 1158 and drove on | What does the rock look like up close? (slope about 18.6°, caution class) |

Every target can be reached from the safe haven in 22.0–45.8 min (Modeled).

## 5. Data products

| Product | What it gives the science | Provenance |
|---|---|---|
| HiRISE orthomosaic, 25 cm (USGS, Mars 2020 TRN) | The base map at walking scale | Observed |
| HiRISE DTM, 1 m (USGS, Mars 2020 TRN) | Slope, go / caution / no-go, walking cost, minutes home, viewsheds | Observed (DTM), Derived (slope), Modeled (cost) |
| Perseverance traverse and waypoints (NASA MMGIS) | Stop and safe-haven positions, viewshed observer points, the checks against the real drive | Observed |
| Mastcam-Z and Navcam raw images (NASA/JPL-Caltech) | Photos on the stop and target cards | Observed |
| MEDA air temperature and pressure, sol 1215 (NASA PDS) | Weather on the day the Sapphire Canyon core was taken | Derived |
| MSL RAD dose rate at Gale crater (Hassler et al. 2014) | Radiation value; Jezero has no surface measurement | Modeled |
| NASA DONKI CME arrival forecasts for Mars (CCMC) | Space weather in the conditions panel, live mode only | Modeled |
| NASA EVA requirements and Mars suit study (NTRS 20210026296, 20260005204) | 20° slope limit, 2 km/h walking speed, 360 min EVA, 60 min reserve | Assumed |
| Apollo 15 Activities Timeline (WUSTL) | 20 min per stop | Derived |

## 6. What the walk model tells an EVA planner

The model turns slope into walking time: 2 km/h on flat ground, slower on slopes (Tobler's curve),
and no-go above 20°. One shortest-path run from the safe haven gives the minutes home from every
2 m cell (`docs/model.md`).

- **The plan fits.** Safe haven → five stops → safe haven is 2.89 km: 119.7 min of walking plus
  100 min at the stops, 219.7 min in all. That leaves 80.3 min before the 60 min reserve in a
  360 min EVA (Modeled).
- **The terrain matters.** 225 min into the EVA, with 75 min left before the reserve, home is still
  reachable from 52.0 % of the area. On flat ground it would be 94.4 % (Modeled).
- **Sanity checks against the rover** (a rover is not a human, so these are not proof of safety):
  - 1.6 % of 4.51 km of Perseverance's track is steeper than our 20° limit (Derived).
  - From Tuff Cliff to Bright Angel our planned leg is 581 m; the rover drove 582 m.
  - The rover's own path is passable in our model on both legs we checked (`docs/validation.md`).

## 7. Replanning: what if something goes wrong

The console has two what-if controls (Simulation):

- **A suit leak** takes minutes off the consumables.
- **Dust or low visibility** slows all walking, the walk home included.

Receding-horizon replanning re-checks the rest of the walk every 5 min and on arrival at each stop.
If the plan no longer gets the astronaut home with the 60 min reserve intact, it suggests the
smallest change that does:

1. Shorten every remaining stop equally, down to 10 min.
2. If that is not enough, skip stops. It never reorders them.
3. If nothing else fits, go home now.

During a storm alert it suggests nothing, because the way home is already on screen.

On the real route:

- **Dust that halves the walking speed**, at Mount Washburn: shorten every stop to 16 min.
- **A 120 min suit leak**, at Bright Angel: skip Masonic Temple.

We checked both on the live site on 2026-11-14: the console showed the same suggestions as the
notebook (`notebooks/replanning.ipynb`, `notebooks/out/replanning_cases.json`). It is a
suggestion only. The crew decides, and the simulated astronaut does not follow it on its own.

## 8. Limitations

- **Lunar and suit-study values on Mars.** The slope limit, walking speed, EVA length and reserve
  come from NASA lunar EVA requirements and a Mars suit (PLSS) design study. No suited walking on
  Mars exists to check them against (Assumed).
- **Earth curve.** The speed-vs-slope shape is Tobler's hiking function for unsuited people on
  Earth.
- **Slope only.** The cost uses slope alone and is the same uphill and downhill. Sand and rock fields
  are not in it. NASA describes the drive to Bright Angel crossing a dune field, and our model
  cannot see that.
- **DTM artefacts.** The terrain has striping in the west of the area, which raises slopes there.
- **Radiation is not from Jezero.** The value was measured by Curiosity at Gale crater and is used
  as a model value.
- **No dust opacity.** MEDA has no dust opacity product in the archive, so that value stays empty.
- **Replanning is simple.** All stops weigh the same: it does not know that Cheyava Falls matters
  most. It changes which stops are visited and for how long, not the path. A suit fault that lowers
  the slope limit would need a new cost map.
- **A rover is not a human.** The checks against Perseverance's drives test the terrain data and
  the planner, not whether a person could walk there safely.
- **Citations still to check.** Four have not yet been checked against the original documents:
  - Tobler 1993,
  - the Science page of Hassler et al. 2014,
  - the "~2 m" camera height in Bell et al. 2021,
  - the credit line on the Apollo 15 timeline page.

  See "Not yet verified" in `docs/model.md`.

## 9. Sources

- NASA/JPL, "NASA's Perseverance Fords an Ancient River to Reach Science Target", 13 June 2024.
  https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-fords-an-ancient-river-to-reach-science-target/
- NASA/JPL, "NASA's Perseverance Rover Scientists Find Intriguing Mars Rock", 25 July 2024.
  https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-rover-scientists-find-intriguing-mars-rock/
- Hurowitz et al. 2025, "Redox-driven mineral and organic associations in Jezero Crater, Mars",
  Nature. https://doi.org/10.1038/s41586-025-09413-0
- Jones et al. 2025, "A fluvio-lacustrine environment preserved in the Jezero crater inlet channel,
  Neretva Vallis (Mars)", EPSC-DPS 2025-888.
  https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-888.html
- Fergason et al. 2020, Mars 2020 TRN HiRISE orthomosaic and DTM mosaic, USGS data releases.
  https://doi.org/10.5066/P9QJDP48, https://doi.org/10.5066/P9REJ9JN
- NASA MMGIS, Mars 2020 traverse and waypoints.
  https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json,
  https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
- Mars 2020 MEDA, NASA PDS Atmospheres Node. https://doi.org/10.17189/1522849
- Hassler et al. 2014, Science 343, 1244797. https://doi.org/10.1126/science.1244797
- Bell et al. 2021, Space Science Reviews 217:24. https://doi.org/10.1007/s11214-020-00755-x
- Scoville, Artemis III EVA mission capability, NTRS 20210026296.
  https://ntrs.nasa.gov/citations/20210026296
- Oliver et al., Mars PLSS design study, ICES 2026, NTRS 20260005204.
  https://ntrs.nasa.gov/citations/20260005204
- Apollo 15 Activities Timeline, WUSTL Lunar Orbital Data Explorer.
  https://an.rsl.wustl.edu/apollo/data/A15/pages/time/time.html
- Tobler 1993, Three presentations on geographical analysis and modeling, NCGIA Technical Report
  93-1 (no URL yet).

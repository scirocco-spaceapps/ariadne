# Walk model

Owner: Bunyamin.

The walk model turns terrain slope into walking time. The planner uses it for routes and for the
return envelope. All numbers live in `model/params.json`; this page explains them. Every
parameter has a `provenance` and a `source` there.

## Parameters

| Parameter | Value | Provenance | Source | Carried over to Mars |
|---|---|---|---|---|
| `max_slope_deg` (no-go above) | 20 deg | Assumed | xEVA System Requirements Document (NASA 2021), quoted in Scoville, NTRS 20210026296 | Lunar suit requirement. Mars gravity is 2.3 times lunar gravity, so slopes are harder; 20 deg is a ceiling, not something to relax. |
| `caution_slope_deg` (caution above) | 15 deg | Assumed | Team choice, no source | Display class only; it does not change cost. |
| `walk_speed_flat_m_per_min` | 33.3 m/min (2 km/h) | Assumed | Del Greco et al. 2021, quoted in Scoville, NTRS 20210026296 | Lunar planning rate. Walking at 0.38 g is closer to Earth gait, so this is conservative. |
| `speed_vs_slope` | factor 1.0 / 0.736 / 0.539 / 0.391 / 0.28 at 0 / 5 / 10 / 15 / 20 deg | Modeled | Tobler 1993 hiking function, normalised | Earth, unsuited. Only the shape is used. |
| `dwell_min` per stop | 20 min | Derived | Median of nine Apollo 15 geology stations (12–65 min, median 21), from the Apollo 15 Activities Timeline (WUSTL) | Lunar station times; the time spent at a station does not depend on gravity as much as walking does. One value for every stop. |
| `budget_min` (planned EVA duration) | 360 min | Assumed | Artemis III SDT nominal EVA 6 ± 2 h; Mars PLSS study 6 h design case (NTRS 20210026296, 20260005204) | Planned duration, not the suit limit: the lunar suit requirement is at least 8 h plus 1 h contingency; no Mars suit exists yet, the Mars PLSS study covers 2–8 h. Show it as "planned EVA duration" in the UI. |
| `reserve_min` | 60 min | Assumed | Mars PLSS study (1 h secondary life support for 4-8 h EVAs); xEVA 1 h contingency | Contingency duration used as walk-home reserve, held inside the budget. |
| `radiation_dose_rate` | 210 uGy/day | Modeled | Hassler et al. 2014, Science 343, 1244797 (MSL RAD, Gale) | Measured at Gale; used as a model value for Jezero. |
| `observer_height_m` | 2.0 m | Observed | Bell et al. 2021, Space Sci. Rev. 217:24 (Mastcam-Z) | Rover camera height; no carry-over needed. |

"Assumed" with a source means a published requirement or design case that we adopted; it is not a
measurement.

The nominal EVA of 6 ± 2 h is a range of planned EVA lengths, not uncertainty in suit endurance.
Uncertainty in consumption is covered by the 60 min reserve, by the suit requirement of at least
8 h (2 h above our plan) and by its 1 h contingency capability.

## How cost is computed

1. Slope per 2 m cell comes from the HiRISE DTM (task A3): the **mean** of the four 1 m Horn
   slopes in the cell. Taking the maximum instead picked up DTM noise: with the maximum, 3.1 % of
   Perseverance's track came out steeper than 20° (median track slope 11.5°, p95 19.2°); the mean
   lowers track slopes by about 1° (median 10.7°, p95 18.2°). The 20° threshold itself stays, since
   it comes from the suit requirement, not from the data.
2. Cells steeper than `max_slope_deg` are impassable.
3. Speed = `walk_speed_flat_m_per_min` x `speed_vs_slope(slope)`, linear interpolation between pairs.
4. Cell cost = 1 / speed, in minutes per metre.
5. `cost_to_home` is one shortest-path run (Dijkstra, 8-connected) from the safe haven (task A4).
6. Margin at a cell = (`budget_min` - elapsed) - `reserve_min` - `cost_to_home`.

## Simplifications

- **Isotropic cost.** Cost does not depend on direction: walking up a slope costs the same as
  walking down it. This is what lets one run from the safe haven stand for the walk back to it.
  Tobler's function is asymmetric (fastest slightly downhill); we use it symmetric in slope.
- **Slope only.** No surface class (sand, rock fields) in the cost yet.
- **Lunar values on Mars.** Slope limit and flat speed come from lunar planning documents.
- **Earth curve.** The speed-vs-slope shape is from Earth hikers without a suit.
- **Radiation from Gale.** Jezero has no surface dose measurement.

## Why this site

Bright Angel, on the northern edge of Neretva Vallis in Jezero crater, holds the Cheyava Falls
rock and its Sapphire Canyon core: the strongest candidate for a sign of ancient life that
Perseverance has found (NASA, July 2024; Hurowitz et al. 2025, Nature). A robot found the clue; a
human geologist at the outcrop could test it. The rover's own route gives us real stops, real
photos and a traverse to validate against, all inside one 2.5 x 2 km area.

Stops (`content/stops/index.json`) are Perseverance's end-of-drive positions on the sol it arrived,
in the rover's order: Mount Washburn (sol 1162), Tuff Cliff (1168), Bright Angel (1175), Cheyava
Falls (1210; core on about sol 1215) and Masonic Temple (1231). Straight-line spacing along that
order is 118, 559, 153 and 401 m (1.23 km). Masonic Temple's sol is inferred from the Malgosa
Crest abrasion (sol 1242, Hurowitz et al. 2025); no NASA news page names it.

The safe haven is a spot where Perseverance parked on sol 1134 (waypoint 52_350), on the Margin
unit east of the channel, with a measured rover tilt of 4.5°, below the 15° caution slope. All
stops are 0.4–1.1 km from it. A straight-line tour haven → stops → haven is about 2.7 km; with 30 %
detour at 33.3 m/min plus five 20-minute dwells that is roughly 205 min, inside the 300 min left
after the reserve. Two checks are still open: the haven's slope on the 2 m raster (A3) and the real
route time on the cost raster (A4).

## Budget check (synthetic)

On a synthetic 2.5 x 2 km site with five stops (sandbox, not real terrain) the plan ended at
t ≈ 279 min: about 179 min walking plus 100 min dwell. With 240 min budget and 60 min reserve the
astronaut could not get home; with 360 min the reserve stays intact. Repeat this check with the
real stops (B2) and the real cost raster (A4): the planned route must end before
`budget_min - reserve_min`.

## Not yet verified

- Tobler 1993: citation written from memory; check the original report.
- Hassler et al. 2014: value read from a copy of the paper, not the Science page.
- Bell et al. 2021: "~2 m" read from a search excerpt of the paper; check the PDF.
- Apollo 15 timeline: the page credits "MSC-07230 Apollo 16 Mission Report"; check that the
  station times are Apollo 15's.
- `walk_speed_flat_m_per_min`: no measured suited walking speed on Mars exists; the lunar planning
  rate is used. Erring slow makes the envelope smaller than reality, which is the safe side.

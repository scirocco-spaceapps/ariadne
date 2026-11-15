# Ariadne — judge's audit (Sun 15 Nov 2026)

Read-only audit of the project as a Space Apps judge would see it: the challenge "Interplanetary
Survival Guide: Martian Map", the five equal criteria (Impact, Creativity, Validity, Relevance,
Presentation, each 1–5) and the 2026 submission rules. Sources read: the game plan, task book and
visual brief (outside the repo), root `CLAUDE.md`, `docs/PLAN_CHANGES.md`, `docs/TASKS.md`,
`docs/DECISIONS.md`, `docs/submission/*`, `docs/notes/*`, `README.md` and the code. Checked by
running the app in DEMO mode and against a local copy of the real assets, by anonymous HTTP checks of
every link, and by looking at all 18 stop photos.

**Bottom line.** The engineering and the honesty (provenance on every number, rover-track check,
terrain-vs-flat comparison) are well above the field. What a judge sees first is weak: the Project
link is a 404 for outsiders, there is no video yet, the page has no images, no challenge mapping and
no "Limitations" heading, and the app looks like a technical tool. Most fixes are text and minutes.

Owners: Yusuf (map, contracts, integration, repo), Nuri (web panels and cuff, CI, deploy), Mazlum
(mission-control), Ali Koray (pipeline, planner, English read), Bunyamin (science, model,
validation), Furkan (stops, e2e, content, submission page, video).

## 1. Fixes, most important first

| # | Severity | Finding (evidence) | Fix | Owner | Effort |
|---|---|---|---|---|---|
| 1 | BLOCKER | **Project link points at the private repo.** `docs/submission/page.md:46`; anonymous GET of `github.com/scirocco-spaceapps/ariadne` returns 404. Same for `page.md:264` (REFERENCES link), `docs/submission/REFERENCES.md:159,162` and the source links of the four target cards `content/stops/target-*.json:36` (clickable in the live app). The rules need public links with no login. | Form: Project link = `https://ariadne-gilt-tau.vercel.app`. Recommended: make the repo public right before the 15:00 final (secret scan clean, MIT in place), then every link resolves. If it stays private: drop the repo links from the page and the four cards. | Yusuf (decision), Furkan (text) | 5 min / 40 min |
| 2 | BLOCKER | **No demo video yet.** `page.md:38` is "TBD"; 8 of 11 boxes in `video.md:148-157` open. The shot list adds up to 30.0 s plus an end card (`video.md:119-125`), i.e. over 30 s. Over 30 s = out of global judging. | Cut to ≤ 29.0 s (end card inside S5), check with `ffprobe`, host without login (YouTube unlisted), test in a private window, burn in English subtitles. | Furkan | 60–90 min |
| 3 | HIGH | **The video never shows the return envelope** (`video.md:111-112` records with the envelope off). Without it the product looks like every other route planner. | Re-record S2/S3 with the Return envelope on, so the green area visibly shrinks; include 2 s of "Without the terrain model". | Furkan, Yusuf | 20 min |
| 4 | HIGH | **Page has no challenge mapping, no "Limitations" heading, no images.** The word "challenge" never appears; limits sit under "Factors we considered" (`page.md:179-196`); no image planned though the form takes JPG/PNG/GIF ≤ 10 MB. | Paste the mapping table in section 3; add `### Limitations` from `README.md:116-131`; upload 4 captioned images (console + envelope, terrain vs flat 52.0 % vs 94.4 %, storm on both screens, a validation figure). | Furkan | 45 min |
| 5 | HIGH | **AI-use statement leaves out the pre-event concept work.** `page.md:200-208` lists coding and docs; `README.md:104-105` says the plan was drafted with Claude; the game plan says the concept options came from Claude's proposal. The guide wants the idea to be the team's and an honest statement. | One shared sentence in page and README: Claude summarised rules, surveyed public projects, listed data and drafted the plan and concept options; the team chose target, site and features. | Yusuf, Furkan (team agrees) | 15 min |
| 6 | HIGH | **A stop photo shows the NASA insignia and JPL logo** on the rover deck: `content/photos/target-mount-washburn_1.jpg` (first photo of that card). Page and README claim "no NASA logos". | Drop or crop that photo (make `_2` first); keep it out of video and page images. | Furkan | 10 min |
| 7 | HIGH | **Public text admits unchecked citations** (`page.md:206-208`) while `page.md:310-311` says every number was checked; Tobler row is "TBD" (`page.md:271`, `REFERENCES.md:174`). | Bunyamin checks Tobler 1993, Hassler 2014, Bell 2021, Apollo 15 now; delete the sentence; anything unverified goes once under Limitations. | Bunyamin, Furkan | 30 min |
| 8 | HIGH | **First impression of the app is "technical and plain"** (the brief for this audit). Local judges hold the phone for 90 s; there is no intro, the storm alert is a flat red page, the console has 15 equal-weight layer rows. | UI redesign PRs listed in `SABAH-RAPORU.md` (tokens, cuff). Merge before 11:00 only after the checks there. | Yusuf / Nuri | review 20 min |
| 9 | MEDIUM | **page.md still says "no licence"** (`page.md:42-44`, `:299-300`); MIT is in `LICENSE` since #75. | Rewrite both notes; add "Code and docs: MIT licence." to the pasted text. | Furkan | 5 min |
| 10 | MEDIUM | **Safety data decides nothing and the page doesn't say so.** DONKI is shown only (`page.md:118-119`), RAD is one Modeled constant, MEDA one archived sol; the storm alert is operator-triggered. | Say it plainly in the mapping table ("shown beside the plan as go/no-go context; storm drill is Simulation") and in Limitations. | Furkan, Bunyamin | 10 min |
| 11 | MEDIUM | **Page says the partner slot "stays empty and says why"** (`page.md:192-193`, `:258-260`); the UI hides it (`web/src/panels/ConditionsPanel.tsx`, card added only when `partner` exists). | Text: "…found none, so the app shows no partner value." | Furkan | 3 min |
| 12 | MEDIUM | **Hosts are `*.sslip.io`; no FortiGuard request on record.** Dynamic-DNS style domains are often blocked on school networks; the N7 fallback covers a lost mission-control, not blocked assets. | Send the categorisation request; next to the live link add "If the map does not load on your network, open `/?demo=1` (synthetic, labelled) or watch the video"; test from venue Wi-Fi and mobile data. | Nuri | 15 min |
| 13 | MEDIUM | **DONKI link timed out twice** (`kauai.ccmc.gsfc.nasa.gov/DONKI/`, used in `page.md:243`, `REFERENCES.md:110`); `ccmc.gsfc.nasa.gov/tools/DONKI/` answers 200. | Use the working URL in page and REFERENCES; leave the in-app URL (mission-control redeploy drops sessions). | Furkan | 5 min |
| 14 | MEDIUM | **Number disagreements** (section 4): 1.6 % vs 1.8 % track above 20°, 10.5° vs 10.7° median slope, dwell "median of nine" vs "median 21, rounded to 20", target distances 79/127 m vs 64–65 m, "25 cm" ortho vs 50 cm served. | Add the reason in one place each (length-weighted vs cell count, rounding, reference point, "25 cm product shown at 50 cm"). | Bunyamin | 20 min |
| 15 | LOW | **e2e live mode** fails at the last clock check (`docs/notes/furkan.md`): the test sends the alert ~2.5 s after Start while the astronaut is still at the haven, so the clock rightly stops on arrival. CI (DEMO) is green. | In `e2e/`: wait until the cuff shows a non-zero walk home before the alert. **For the demo: give the alert mid-walk.** | Furkan | 20 min |
| 16 | LOW | **Wake lock untested on a phone** (`docs/notes/nuri.md:154-156`): "Keep screen on" was never tapped and the screen dimmed. | Retest: tap, check "Screen stays on", wait past the timeout. For judging also set the phone's screen timeout to max. | Nuri | 5 min |
| 17 | LOW | **PWA icons missing** (`docs/notes/nuri.md:163-165`): manifest has no `icons`, so Chrome won't install; `start_url` lacks `?s=`. | Skip for the demo. If done: two hand-drawn PNGs (192/512, no NASA marks). | Nuri | 20 min |
| 18 | LOW | Project Details is 1,693 words with backticked repo paths and the plan numbers twice (`page.md:106-108`, `:134-136`). | Check the form limit, remove the duplicate, strip backticks. | Furkan, Ali Koray | 15 min |
| 19 | LOW | REFERENCES misses pydantic, Jupyter, GitHub Actions, Let's Encrypt, sslip.io, api.nasa.gov. | Add rows. | Furkan | 10 min |

## 2. The five criteria

| Criterion | What we deliver | Evidence | Weak or missing | Fix (# above) | Score now → after fixes |
|---|---|---|---|---|---|
| **Impact** | EVA walk-back safety: every point answers "can I still get home?" | `README.md`, envelope in `web/src/map/envelope.ts`, cuff margin | Page argues it in 5 lines; no "who uses it, which decision changes, ports to other sites" | Add: "Any site with a DTM and a start point loads by changing one site file; on flat ground 94.4 % of the site looks reachable at T+225, on the real terrain 52.0 %." | 3 → 4 |
| **Creativity** | Terrain-shaped return envelope, terrain-vs-flat toggle, two screens on one clock, storm drill, seen-not-touched targets, replanning suggestion | `MapView.tsx` (Y5, Y6, Y9, MPC-2), `Cuff.tsx` | Not visible in the video (3); undersold on the page ("not a radius, a shape") | 3, 4, 8 | 4 → 5 |
| **Validity** | Provenance labels everywhere, sourced params (`model/params.json`), rover-track check, DEM vs rover elevation, honest limits, e2e test | `docs/validation.md`, `notebooks/`, `e2e/tests/demo90.spec.ts` | Self-inflicted doubt (7), disagreeing numbers (14), repo invisible (1), validation figure not on the page | 1, 7, 14, 4 | 4 → 5 |
| **Relevance** | MRO HiRISE ortho + DTM, Mars 2020 track/waypoints/photos/MEDA, MSL RAD, DONKI; five data types | `contracts/aoi.json`, `docs/DATA_SOURCES.md`, NASA-data table in `page.md:233-248` | No mapping to the challenge asks (4); safety data is display-only (10); no geology layer (`geology.geojson` 404 on the asset host) | 4, 10; one Limitations line "no geologic-map layer" | 3 → 4 |
| **Presentation** | Clear 166-word summary; 65-word video script | `page.md:21-25`, `video.md` | No video, no images, 404 project link, technical-looking UI | 1, 2, 3, 4, 8 | 2 → 4 |

## 3. Challenge asks → Ariadne (paste into the page)

| The challenge asks for | In Ariadne | Status |
|---|---|---|
| A layered, integrated view from several NASA missions | MRO HiRISE image and terrain, Mars 2020 track, waypoints, Mastcam-Z/Navcam photos and MEDA weather, MSL RAD dose rate, DONKI forecasts, on one metre grid | delivered |
| Walking scale, not regional | One 2.5 × 2 km site; 1 m terrain; 2 m cost cells | delivered |
| A science goal and a fitting place | Possible biosignature at Cheyava Falls, Bright Angel, Jezero | delivered |
| At least three data types | Optical, topographic, atmospheric, radiation, space weather | delivered |
| Safety: radiation and space weather | RAD (Gale, Modeled) and live DONKI CME arrivals beside the plan; simulated storm alert draws the way home on both screens | shown, does not drive the route (#10) |
| Moving in a suit; a route that avoids obstacles | 20° no-go limit, slope-dependent speed, least-cost route, return envelope | delivered |
| Tablet or HUD | Mission console + phone worn as a wrist cuff | delivered |
| Plan **and** carry out | Console plans; cuff carries it out on the same clock | delivered |
| The rover's-eye view | Perseverance's own photos at every stop | delivered (one photo has a logo, #6) |
| Rover support / buddy | Pressurized rover as safe haven; crewmate at the console sees the same margin | delivered |

## 4. Numbers that disagree

| What | A | B | Fix |
|---|---|---|---|
| Rover track above 20° | 1.6 % (`page.md:111`, `science.md:115`, `validation.md:53`) | 1.8 % (`model.md:38`, `DATA_SOURCES.md:46`) | "length-weighted; 1.8 % by cell count" |
| Median slope on track | 10.5° (`validation.md:48`) | 10.7° (`model.md:37`) | same cause, say so |
| Dwell | "median of nine Apollo 15 stations" (`page.md:246`) | "median 21, rounded to 20" (`model.md:17`) | "median 21 min, rounded to 20" |
| Target distance | 79 m / 127 m (`science.md:82,84`) | 63.8 / 65.0 m (`targets.geojson`) | name the reference point |
| Ortho | "25 cm" (`page.md:88,235`) | 50 cm / 1 m files served | "25 cm product, shown at 50 cm" |
| Licence | "no licence" (`page.md:43,300`) | MIT (`LICENSE`) | #9 |

Consistent everywhere (checked): 2.89 km, 119.7 + 100 = 219.7 min, 80.3 min margin, 360/60 budget and
reserve, 52.0 % vs 94.4 % at T+225, 4.51 km track, 20° and 15° limits.

## 5. Rules checklist (2026 guide)

| Rule | Verdict |
|---|---|
| Demo ≤ 30 s video (or ≤ 7 slides) | RISK — not made yet; shot list sums to 30.0 s + end card (#2) |
| Script English, ~70 words | OK — 65 words |
| Demo and project links public, no login | VIOLATION as written (#1); live app `/` and `/cuff` answer 200 without login |
| NASA data named per layer | OK — every `aoi.json` layer traces to a row; add "viewsheds" and "flat-ground variant" to the DTM row |
| Partner / other data | OK, honest (wording #11) |
| AI-use statement | RISK (#5) |
| AI-generated images | OK — none (NASA raw photos, UI screenshots, matplotlib figures, code-drawn graphics) |
| No NASA logos / mission patches | RISK (#6); the redesign draws everything in code and adds no logo |
| Nobody under 18 on screen | OK by design (screen captures only); keep it so in the venue |
| AI code declared | OK — README section; every commit has a Co-Authored-By trailer (visible only if the repo is public) |
| All six members on the team page | check on the platform |

## 6. What is fine

Summary length (166 words, 890 chars); photo credits and raw-image links; live `/conditions`
matches the page; Simulation/SYNTHETIC labelling in app and text; the N7 fallback no longer replays a
storm (#85); DEMO e2e green on main.

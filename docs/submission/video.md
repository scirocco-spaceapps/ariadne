# Ariadne — 30-second video

Owner: Furkan. Task F5. English.

**Status: LOCK PENDING.** Variant A is the proposed lock. It becomes locked when the three human
checks under "Locked script" are filled in.

## Rules

- At most 30 seconds. A video over 30 s is not judged globally.
- At most 70 words of narration.
- Space Apps beat structure: 0:00 name and team · 0:02 the challenge · 0:05 project name and
  tagline · 0:10 how it works and which NASA data · 0:20 what it could become.
- Screen captures only. No people on screen, so no one under 18 on screen.
- No NASA logos or mission patches, no AI-generated images. Every photo on screen shows its credit
  line.
- Say only what a shot shows. The e2e video is **SYNTHETIC** demo data. It is never presented as
  real data: the "DEMO DATA" badge stays in frame and the caption says so. The storm alert is a
  **simulated** alert. Never call it a forecast or a real storm.

How the numbers below were made: words = whitespace-separated tokens, so "walking-scale" is one
word. Seconds are an estimate at 2.5 words/s (150 words/min) plus a 0.4 s pause between sentences.
The real time comes from reading the script aloud (see "Locked script").

## Three variants

### Variant A — "a thread home" (locked wording, Ali Koray's revision)

| # | Beat | Est. time | Sentence | Words |
|---|---|---|---|---|
| A1 | name and team | 0:00.0–0:01.2 | We’re Team Scirocco. | 3 |
| A2 | the challenge | 0:01.6–0:04.4 | Every Mars walk needs a way back. | 7 |
| A3 | name and tagline | 0:04.8–0:08.4 | This is Ariadne: a thread home from every step. | 9 |
| A4 | how it works, NASA data | 0:08.8–0:16.0 | Built on NASA HiRISE images and terrain of Jezero crater, it plans a route through stops Perseverance studied. | 18 |
| A5 | how it works | 0:16.4–0:21.6 | When a storm alert comes in, both screens show the fastest way home. | 13 |
| A6 | what it could become | 0:22.0–0:28.4 | Tomorrow, it could guide crews on the Moon and Mars, one safe step at a time. | 16 |
| | **Total** | **28.4 s** | | **66** |

### Variant B — "the science walk"

| # | Beat | Est. time | Sentence | Words |
|---|---|---|---|---|
| B1 | name and team | 0:00.0–0:01.6 | We are team Scirocco. | 4 |
| B2 | the challenge | 0:02.0–0:05.2 | Every Mars walk must end back at base. | 8 |
| B3 | name and tagline | 0:05.6–0:09.6 | Ariadne plans the science walk and keeps the thread home. | 10 |
| B4 | how it works, NASA data | 0:10.0–0:14.8 | It routes stops Perseverance studied, on NASA HiRISE maps of Jezero crater. | 12 |
| B5 | how it works | 0:15.2–0:20.4 | A storm alert reaches both screens, and the map draws the thread home. | 13 |
| B6 | what it could become | 0:20.8–0:25.2 | Next, it could help crews and scientists plan real walks together. | 11 |
| | **Total** | **25.2 s** | | **58** |

### Variant C — "walking-scale map"

| # | Beat | Est. time | Sentence | Words |
|---|---|---|---|---|
| C1 | name and team | 0:00.0–0:01.6 | We are team Scirocco. | 4 |
| C2 | the challenge | 0:02.0–0:04.8 | Astronauts will cross Mars metre by metre. | 7 |
| C3 | name and tagline | 0:05.2–0:10.0 | Ariadne is a walking-scale map that keeps the way home in view. | 12 |
| C4 | how it works, NASA data | 0:10.4–0:15.6 | It turns NASA HiRISE images and terrain into slope maps and walking times. | 13 |
| C5 | how it works | 0:16.0–0:20.4 | If a storm alert comes, the console draws the thread home. | 11 |
| C6 | what it could become | 0:20.8–0:25.2 | Next, it could plan real walks on the Moon and Mars. | 11 |
| | **Total** | **25.2 s** | | **58** |

Why A: it names the NASA data and the storm alert, and it leaves about 1.5 s for the end card.
B and C end around 0:25, so their last shot has to be held longer. In Ali Koray's revision the
beats start a little early (0:01.6, 0:04.8, 0:08.8) and the last beat starts at 0:22.0, not 0:20,
because the NASA-data sentence is longer (18 words, about 7 s).

## Locked script

> We’re Team Scirocco. Every Mars walk needs a way back. This is Ariadne: a thread home from every
> step. Built on NASA HiRISE images and terrain of Jezero crater, it plans a route through stops
> Perseverance studied. When a storm alert comes in, both screens show the fastest way home.
> Tomorrow, it could guide crews on the Moon and Mars, one safe step at a time.

66 words, about 28.4 s (estimate).

Human checks (the card's steps 1 and 2). The script is locked when all three are filled in:

- Read-aloud time, measured by Furkan: ___ s (must be ≤ 30 s, final card included)
- Read by Ali Koray: done, wording changes applied
- Read to the team at the 23:30 check: ___ (OK / changes)

## Shot list (Variant A)

The final video is 1920 x 1080. e2e shots come from the F4 test `e2e/tests/demo90.spec.ts` in DEMO
mode. To make them, run `cd e2e && npm test`. The output goes to
`e2e/test-results/demo90-demo90-console-and-cuff-through-a-storm-alert-chromium/`:

- console video: `video-console/*.webm` (1440 x 900)
- cuff video: `video-cuff/*.webm` (390 x 844)
- screenshots for each phase: `01-running`, `02-alert`, `02b-home`, `03-clear` (`-console.png`,
  `-cuff.png`)

Video timestamps change from run to run, so each clip is located by the **session clock** on
screen (`T+ m:ss`). Fixture times: storm alert at T+0:30, home at T+0:38, clear at T+0:50.

Real-data shots (R1, R2) are **TO RECORD**. They are not in the e2e video, which has synthetic data
only. Record them from the console running on real assets: production
`https://ariadne-gilt-tau.vercel.app`, or a local web app with `VITE_ASSETS_URL` on the real
bundle. On 2026-11-14 the production console listed the real stops and layers, but the HiRISE
image did not render because the assets host was offline. Record when it is back up.

| Sentence | Shot | Source | On screen | Caption / credit |
|---|---|---|---|---|
| A1 We’re Team Scirocco. | S1 | e2e console video, first 2 s (console loads) | Header "ARIADNE MISSION CONSOLE · Bright Angel · Jezero crater", "DEMO DATA" badge | Text overlay "Team Scirocco · NASA Space Apps 2026" (text only, no logo) |
| A2 Every Mars walk needs a way back. | S2 | e2e console video around T+0:05 (= `01-running-console.png`) | Astronaut leaving the safe haven on the planned route; return-envelope legend "Back with ≥ 30 min to spare" | "Synthetic demo data" |
| A3 This is Ariadne: a thread home from every step. | S3 | e2e console + cuff side by side around T+0:05 (= `01-running-console.png` + `01-running-cuff.png`) | Same clock on both screens; cuff "MARGIN TO HOME +201 min · Safe to continue" | Title "Ariadne" over the shot; "Synthetic demo data" |
| A4 Built on NASA HiRISE images and terrain of Jezero crater, … | R1 — **TO RECORD**, about 4.5 s | Real-data console: layers Orthoimage MRO HiRISE (Observed) and Hillshade from DEM (Derived) on, Fit AOI, then **Plan route** with the five stops (Mount Washburn, Tuff Cliff, Bright Angel, Cheyava Falls, Masonic Temple) | HiRISE map of Bright Angel with the route drawn and the leg table filled in | HiRISE credit as filled in `REFERENCES.md`. That row is still TBD: fill it before the video is cut |
| A4 … it plans a route through stops Perseverance studied. | R2 — **TO RECORD**, about 2.5 s | Real-data console, STOP tab on `bright-angel` | Stop card with Perseverance photo `bright-angel_1.jpg` and its credit line | "NASA/JPL-Caltech/ASU" (in the card) |
| A5 When a storm alert comes in, both screens show the fastest way home. | S4 | e2e console + cuff side by side, T+0:30 → T+0:33 (= `02-alert-console.png` + `02-alert-cuff.png`) | Console: red strip "STORM ALERT · time to storm", red thread "Way home before the storm". Cuff: "STORM ALERT · Follow the thread home" | "Simulated storm alert · synthetic demo data" |
| A6 Tomorrow, it could guide crews on the Moon and Mars, one safe step at a time. | S5 → end card | e2e console + cuff T+0:38 (= `02b-home-*`), then T+0:50+ (= `03-clear-cuff.png`) | Astronaut reaches the safe haven; after the clear the cuff shows "Safe to continue · Home: the walk is done." End card for the last ~2 s: text "Ariadne · team Scirocco" | "Synthetic demo data" on S5; end card is text only |

## Claim check (Variant A)

| Claim | Shown in | Source |
|---|---|---|
| Jezero crater, Bright Angel | S1 header; R1 | `docs/DATA_SOURCES.md` AOI and stop rows |
| NASA HiRISE images | R1 (layer "Orthoimage, MRO HiRISE", Observed) | `DATA_SOURCES.md` row `ortho_50cm.jpg`, `ortho_1m.jpg` (USGS Mars 2020 TRN HiRISE orthomosaic) |
| NASA HiRISE terrain | R1 (layer "Hillshade (from DEM)", Derived) | `DATA_SOURCES.md` rows `dem_4m.f32` / `hillshade_2m.png` (USGS HiRISE DTM 1 m) |
| plans a route through stops | R1 (Plan route, leg table) | `DATA_SOURCES.md` planned-walk row (planner /route), Modeled |
| stops Perseverance studied | R2 (stop card with Perseverance photo) | `DATA_SOURCES.md` stop-position row (M20_waypoints.json, sols 1162–1231); `REFERENCES.md` stop photos |
| a thread home from every step | S3 (cuff margin to home); S2 (return-envelope legend) | Return envelope = `cost_to_home_2m.f32`, Modeled. Shown here on synthetic data |
| storm alert reaches both screens | S4 | F4 e2e test asserts it on both contexts. Alert is simulated (fixture `ws-state.jsonl`) |
| both screens show the way home | S4: console red thread; cuff "Follow the thread home" and walk-home minutes (the cuff shows no map) | F4 e2e test (red-thread pixel check) |
| the fastest way home | Not shown as "fastest" on screen. In S4 the thread comes from the synthetic fixture, not from the planner | In a live session the abort path is the least-time path under the walk model (planner `/abort`, same MCP set-up as `cost_to_home`), Modeled. See `DATA_SOURCES.md` cost-to-home row |
| could guide crews on the Moon and Mars | — (future, said as "could") | Not a demo claim |

Not claimed anywhere in the script: a live or forecast storm (DONKI), live weather, partner data,
or any number from the synthetic fixture.

## Before the cut

- [ ] Read-aloud time ≤ 30 s, end card included
- [ ] ≤ 70 words (A: 66)
- [ ] No person on screen; voice only
- [ ] No NASA logo or mission patch anywhere, including browser tabs and favicons in the capture
- [ ] "DEMO DATA" badge visible and "Synthetic demo data" caption on S1–S5
- [ ] R1 and R2 recorded on real assets; credit lines on screen (HiRISE credit filled in
      `REFERENCES.md`, photo credit "NASA/JPL-Caltech/ASU")
- [ ] No AI-generated images

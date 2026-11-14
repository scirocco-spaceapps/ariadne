# content/

**Owner:** Furkan, except `stops/index.json` and `conditions/` (Bunyamin).

**Purpose:** human-written stop content shown in the web app: science questions, tasks, photos and
captions, in the `StopContent` shape (`contracts/openapi.yaml`, example in
`contracts/fixtures/stops.json`). `conditions/` holds reference notes for the conditions panel.

**Run:** nothing to run.

**Test:** `python -c "import json; json.load(open('content/stops/index.json'))"`; stop ids must match
`contracts/aoi.json`.

**Rules:** every photo has `credit`, `sol` and `camera` from its NASA source page. No NASA logos,
no mission patches, no AI-generated images. English only.

**Must not touch:** `web/` code, `contracts/`, root config, CI.

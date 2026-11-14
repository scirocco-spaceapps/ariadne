# Validation

Owner: Bunyamin.

How the walk model, the rasters and the conditions data were checked, with the script or notebook
that reproduces each check.

## Conditions: MEDA weather for sol 1215

Reproduce: `python notebooks/meda_sol.py --sol 1215` → `content/conditions/meda.json`.

Sol 1215 is the day the Sapphire Canyon core was taken at Cheyava Falls (July 21, 2024). The values
come from the Mars 2020 MEDA bundle on the NASA PDS Atmospheres Node (dataset doi:10.17189/1522849).

| Value | Sol 1215 | Product | Method |
|---|---|---|---|
| Air temperature, min | 192.0 K (−81.1 °C), at about 05:02 LMST | `CAL_ATS` (calibrated) | Median of the three mast sensors at each time step, then the minimum over the sol |
| Air temperature, max | 259.6 K (−13.6 °C), at about 15:50 LMST | `CAL_ATS` | Same median, maximum over the sol |
| Pressure, daily mean | 744.7 Pa (range 727.7–759.0 Pa) | `DER_PS` (derived) | Mean over the sol |
| Dust opacity | not available | — | The PDS bundle has no MEDA opacity product (RDS is calibrated irradiance only) |

- The two sensors on the rover body read up to 20 K warmer in the afternoon (279 K vs 252–264 K on
  the mast), so they are left out.
- The mast sensors themselves differ by up to 12 K at the daily maximum. The median of three is a
  simple, stated choice, not the MEDA team's own air-temperature product.
- Provenance is **Derived**: computed from Observed calibrated data by the method above.
- Checked: the object mission-control serves from this file (`provenance`, `source`, `source_url`,
  `mode: archive`, `sol`, `values`, `units`) validates against the `Weather` schema in
  `contracts/openapi.yaml`.

_Still to come (B4): slope along the rover track (no-go share with max vs mean aggregation, see
`docs/notes/bunyamin.md`) and planned route vs rover path._

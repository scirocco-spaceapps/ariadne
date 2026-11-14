# Notes for Yusuf

Owner of this file: Yusuf (`contracts/`, `web/src/map/`).
Delete each note in the PR that handles it.

## 2026-11-14 — from Bunyamin (task B4, MEDA): DATA_SOURCES row

- **What:** append to `docs/DATA_SOURCES.md` (outside B4's allowed paths):

```
| `content/conditions/meda.json`: sol 1215 air temperature min 192.0 K / max 259.6 K (median of the three mast ATS sensors), pressure 744.7 Pa (daily mean), dust opacity null | Mars 2020 MEDA, NASA PDS Atmospheres Node, CAL_ATS and DER_PS for sol 1215 (doi:10.17189/1522849); notebooks/meda_sol.py | Derived |
```
- **Why:** every value shown in the conditions panel needs a row. PR: B4 MEDA.

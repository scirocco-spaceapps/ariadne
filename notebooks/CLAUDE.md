# notebooks/

**Owner:** Bunyamin.

**Purpose:** Jupyter notebooks for exploring data and validating the walk model. Results that
matter move into `model/params.json`, `docs/model.md` or `docs/validation.md`.

**Run:** `pip install jupyter` in your own venv, then `jupyter lab notebooks/`.

**Test:** notebooks must run top to bottom (`jupyter nbconvert --to notebook --execute <nb>`).
Clear large outputs before committing; read raw data from `data/` (git-ignored).

**Must not touch:** anything outside `notebooks/`.

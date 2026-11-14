import importlib.util

import numpy as np
from PIL import Image

from aoi import REPO


def _mod():
    spec = importlib.util.spec_from_file_location("pub", REPO / "pipeline" / "scripts" / "08_publish_science.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def _png(path, size, values):
    a = np.zeros((size[1], size[0], 4), dtype="uint8")
    for i, v in enumerate(values):
        a[i, 0] = v
    Image.fromarray(a, "RGBA").save(path)


def test_png_check_size_mode_and_no_antialiasing(tmp_path):
    pub = _mod()
    ok = tmp_path / "ok.png"
    _png(ok, (20, 10), [(255, 128, 0, 255)])
    assert pub.check_png(ok, (40, 20), 2.0) == []
    assert pub.check_png(ok, (40, 40), 2.0)  # wrong size
    blended = tmp_path / "aa.png"
    _png(blended, (20, 10), [(255, 128, 0, 255), (255, 128, 0, 120)])
    assert any("distinct" in e for e in pub.check_png(blended, (40, 20), 2.0))
    Image.new("RGB", (20, 10)).save(tmp_path / "rgb.png")
    assert any("RGBA" in e for e in pub.check_png(tmp_path / "rgb.png", (40, 20), 2.0))


def test_targets_check_schema_bounds_and_ids():
    pub = _mod()

    def coll(*pts):
        return {"type": "FeatureCollection", "provenance": "Derived", "source": "SYNTHETIC test",
                "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": list(p)},
                              "properties": {"id": i, "area_m2": 100.0, "distance_m": 10.0, "sol": 1200}}
                             for i, p in pts]}

    assert pub.check_targets(coll(("a", (10, 10)), ("b", (20, 20))), (2500, 2000)) == []
    assert any("outside" in e for e in pub.check_targets(coll(("a", (77.3, 18.49 + 3000))), (2500, 2000)))
    assert any("duplicate" in e for e in pub.check_targets(coll(("a", (1, 1)), ("a", (2, 2))), (2500, 2000)))
    bad = coll(("a", (1, 1)))
    del bad["features"][0]["properties"]["sol"]
    assert pub.check_targets(bad, (2500, 2000))  # schema: sol required

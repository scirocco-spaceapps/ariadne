"""Checks for replanning.py: the rule's order (none, shorten, drop, home) on a SYNTHETIC walk, and
that decide() reproduces notebooks/out/replanning_cases.json (the file the web port tests against).

Run: python -m pytest notebooks/test_replanning.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import replanning as rp  # noqa: E402

P = {"budget_min": 360, "reserve_min": 60, "dwell_min": 20, "min_dwell_min": 10}

# SYNTHETIC: three stops a -> b -> c, 10 min walk between neighbours, 30 min from each stop home.
WALK = {"a": {"b": 10, "c": 18}, "b": {"c": 10}, "c": {}}
HOME = {"a": 30, "b": 30, "c": 30}


def at(stop, t, **trig):
    order = ["a", "b", "c"]
    return {"t_min": t, "start": stop, "lead_min": 0.0, "remaining": order[order.index(stop) + 1:],
            "home_now_min": HOME[stop], **trig}


def test_fits_no_suggestion():
    r = rp.decide(at("a", 30), WALK, HOME, P)
    # 30 + 10 + 10 + 30 walk + 3 x 20 dwell = 140 <= 300
    assert r["action"] == "none" and r["kept"] == ["b", "c"] and r["margin_min"] == 160.0


def test_shorten_before_drop():
    # 300 - 220 = 80 min spare for 50 walk + 3 dwells -> 10 min each fits, 11 does not
    r = rp.decide(at("a", 220), WALK, HOME, P)
    assert r["action"] == "shorten_dwells" and r["dwell_min"] == 10.0 and r["dropped"] == []


def test_drop_keeps_order_and_most_stops():
    r = rp.decide(at("a", 235), WALK, HOME, P)
    assert r["action"] == "drop_stops" and len(r["kept"]) == 1
    # dropping b leaves a -> c (18) shorter than a -> b (10) + b home (30)? both 48; tie -> longer dwell, then margin
    assert r["kept"] in (["b"], ["c"])
    assert r["margin_min"] >= 0


def test_go_home_now_when_nothing_fits():
    r = rp.decide(at("a", 290), WALK, HOME, P)
    assert r["action"] == "go_home_now" and r["kept"] == [] and r["dwell_min"] == 0.0
    assert r["end_min"] == 320.0 and r["margin_min"] == -20.0 and r["reserve_at_home_min"] == 40.0


def test_speed_factor_scales_walking_only():
    r1 = rp.decide(at("a", 30), WALK, HOME, P)
    r2 = rp.decide(at("a", 30, speed_factor=0.5), WALK, HOME, P)
    # walking 50 -> 100 min, dwells unchanged
    assert r2["end_min"] - r1["end_min"] == pytest.approx(50.0)


def test_leak_moves_the_deadline():
    r = rp.decide(at("a", 30, leak_min=100), WALK, HOME, P)
    assert r["deadline_min"] == 200.0 and r["margin_min"] == 60.0


def test_dwell_already_spent_counts():
    fresh = rp.decide(at("a", 220), WALK, HOME, P)
    later = rp.decide({**at("a", 225), "dwell_done_min": 5.0}, WALK, HOME, P)
    assert later["dwell_min"] == fresh["dwell_min"] and later["end_min"] == fresh["end_min"]


def test_never_reorders():
    for t in range(30, 300, 5):
        r = rp.decide(at("a", t), WALK, HOME, P)
        assert r["kept"] == sorted(r["kept"])


def test_cases_file_reproduces():
    path = HERE / "out" / "replanning_cases.json"
    if not path.exists():
        pytest.skip("run notebooks/replanning.ipynb first")
    doc = json.loads(path.read_text(encoding="utf-8"))
    for c in doc["cases"]:
        assert rp.decide(c["input"], doc["walk_min"], doc["home_min"], doc["params"]) == c["expected"], c["id"]

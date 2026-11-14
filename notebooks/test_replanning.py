"""Checks for replanning.py: the rule on a SYNTHETIC walk, and that decide() reproduces
notebooks/out/replanning_cases.json (decisions exact, times within the file's tolerance). MPC-2's
web tests use the same file and notebooks/out/route.json, not the live planner.

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

# SYNTHETIC: stops a -> b -> c, 10 min between neighbours, a -> c 20 min, 30 min from each stop home.
LEGS = {"haven": {"a": 30, "b": 30, "c": 30},
        "a": {"b": 10, "c": 20, "haven": 30}, "b": {"c": 10, "haven": 30}, "c": {"haven": 30}}


def at(stop, t, **kw):
    order = ["a", "b", "c"]
    return {"t_min": t, "current_stop": stop, "lead_min": 0.0, "dwell_done_min": 0.0,
            "remaining": order[order.index(stop) + 1:], "home_now_min": LEGS[stop]["haven"], **kw}


def test_plan_fits():
    r = rp.decide(at("a", 30), LEGS, P)
    # walk 10 + 10 + 30 = 50, dwells 3 x 20 = 60: end 140, deadline 300
    assert (r["action"], r["reason"], r["dwell_min"]) == ("none", "plan_fits", 20)
    assert r["margin_min"] == 160 and r["reserve_left_min"] == 220


def test_shorten_in_one_minute_steps_before_dropping():
    # spare after walking = 300 - 215 - 50 = 35 for 3 dwells -> 11 min
    r = rp.decide(at("a", 215), LEGS, P)
    assert (r["action"], r["dwell_min"], r["dropped"]) == ("shorten_dwells", 11, [])


def test_drop_keeps_order_most_stops_then_dwell_then_tie_keeps_earlier():
    # nothing fits with 3 stops at 10 min; with 2 stops: keep b (a->b->home 40) or keep c (a->c->home 50)
    r = rp.decide(at("a", 235), LEGS, P)
    assert r["action"] == "drop_stops" and r["kept"] == ["b"] and r["dropped"] == ["c"]


def test_tie_keeps_the_earlier_stop():
    legs = {**LEGS, "a": {"b": 10, "c": 10, "haven": 30}}   # a->b->home == a->c->home
    r = rp.decide(at("a", 240), legs, P)
    assert r["kept"] == ["b"]


def test_go_home_now_and_dust_applies_to_home():
    r = rp.decide(at("a", 290), LEGS, P)
    assert (r["action"], r["kept"], r["dwell_min"]) == ("go_home_now", [], 0)
    assert r["end_min"] == 320 and r["margin_min"] == -20 and r["reserve_left_min"] == 40
    slow = rp.decide(at("a", 290, speed_factor=0.5), LEGS, P)
    assert slow["end_min"] == 350


def test_leak_moves_the_deadline():
    r = rp.decide(at("a", 30, leak_min=100), LEGS, P)
    assert r["deadline_min"] == 200 and r["margin_min"] == 60


def test_dwell_spent_at_current_stop():
    fresh = rp.decide(at("a", 215), LEGS, P)
    later = rp.decide({**at("a", 220), "dwell_done_min": 5.0}, LEGS, P)
    assert later["dwell_min"] == fresh["dwell_min"] and later["end_min"] == fresh["end_min"]
    # spent more than the new dwell: nothing left to do there
    # (t 245, 30 min spent): keep b, a -> b -> home 40 min walk, 0 min more at a, 15 min at b
    over = rp.decide({**at("a", 245), "dwell_done_min": 30.0}, LEGS, P)
    assert (over["kept"], over["dwell_min"], over["end_min"]) == (["b"], 15, 300)


def test_storm_alert_suppresses_suggestion():
    r = rp.decide(at("a", 290, storm_alert=True), LEGS, P)
    assert (r["action"], r["reason"], r["dropped"]) == ("none", "storm_alert", [])


def test_lead_on_leg():
    path = [[0, 0], [100, 0], [100, 100]]
    assert rp.lead_on_leg(path, 50, 3, 20.0) == pytest.approx(15.0)   # 150 of 200 m left
    assert rp.lead_on_leg(path, 100, 100, 20.0) == pytest.approx(0.0)


def test_never_reorders():
    for t in range(30, 300, 5):
        kept = rp.decide(at("a", t), LEGS, P)["kept"]
        assert kept == sorted(kept)


def test_cases_file_reproduces():
    doc = json.loads((HERE / "out" / "replanning_cases.json").read_text(encoding="utf-8"))
    route = json.loads((HERE / "out" / "route.json").read_text(encoding="utf-8"))
    assert doc["legs_min"] == route["legs_min"]
    tol = doc["matching"]["tolerance_min"]
    for c in doc["cases"]:
        assert c["planner_commit"] == route["planner_commit"]
        got = rp.decide(c["input"], route["legs_min"], c["params"])
        for k in doc["matching"]["exact"]:
            assert got[k] == c["expected"][k], (c["id"], k)
        for k, t in tol.items():
            assert abs(got[k] - c["expected"][k]) <= t, (c["id"], k)

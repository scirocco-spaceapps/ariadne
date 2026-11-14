"""Task MPC-1: receding-horizon replanning, the rule behind the console suggestion.

During the walk two what-if controls can shrink the time left: a suit leak (the consumables budget
drops by leak_min) and dust / low visibility (walking slows by speed_factor). The rule re-checks the
rest of the plan and suggests the smallest change that still gets the astronaut home with the
reserve intact. The rule in words, with the reason for each line: docs/model.md, "Replanning".

Definitions (all times in minutes):
  deadline     = budget_min - leak_min - reserve_min
  D            = time still needed: walking (lead to the current stop + legs between kept stops +
                 leg home) / speed_factor + remaining dwells
  margin       = deadline - (t + D)          (negative: the reserve is in use)
  reserve_left = reserve_min + margin        (reserve at the haven on arrival)

`decide` uses only plain Python so the web port (MPC-2) can follow it line by line.
"""

from __future__ import annotations

import itertools
import json
import math
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HAVEN = "haven"


# ---------------------------------------------------------------- the rule

def walk_time(start: str, kept: list[str], lead_min: float, legs: dict) -> float:
    """Nominal walking minutes (speed factor 1): lead to `start`, then start -> kept stops -> haven."""
    t, at = lead_min, start
    for s in kept:
        t += legs[at][s]
        at = s
    return t + legs[at][HAVEN]


def longest_dwell(spare: float, n: int, done: float, p: dict) -> int | None:
    """Longest equal dwell d, whole minutes from dwell_min down to min_dwell_min, such that the n
    remaining dwells fit in `spare`. The first one (current stop) already ran for `done` minutes,
    so it needs only max(0, d - done)."""
    d = math.floor(p["dwell_min"])
    while d >= p["min_dwell_min"]:
        if max(0.0, d - done) + (n - 1) * d <= spare + 1e-9:
            return d
        d -= 1
    return None


def decide(state: dict, legs: dict, p: dict) -> dict:
    """Suggestion for the rest of the walk.

    state: t_min; current_stop (the stop the astronaut is at, or walking to); lead_min (nominal
      minutes still to walk to current_stop, 0 when there); dwell_done_min (minutes already spent
      at current_stop); remaining (stop ids after current_stop, plan order); home_now_min (nominal
      cost_to_home at the astronaut's x, y); speed_factor; leak_min; storm_alert.
    legs[a][b]: nominal walking minutes a -> b (pairs in plan order, stop -> haven, haven -> stop).
    p: budget_min, reserve_min, dwell_min, min_dwell_min.
    """
    t, f = state["t_min"], state.get("speed_factor", 1.0)
    deadline = p["budget_min"] - state.get("leak_min", 0.0) - p["reserve_min"]
    start, rem = state["current_stop"], list(state["remaining"])
    lead, done = state.get("lead_min", 0.0), state.get("dwell_done_min", 0.0)

    def out(action, reason, kept, dwell, need):
        margin = deadline - (t + need)
        return {"action": action, "reason": reason, "deadline_min": round(deadline, 2),
                "kept": kept, "dropped": [s for s in rem if s not in kept], "dwell_min": dwell,
                "end_min": round(t + need, 2), "margin_min": round(margin, 2),
                "reserve_left_min": round(p["reserve_min"] + margin, 2)}

    def need(kept, d):
        return walk_time(start, kept, lead, legs) / f + max(0.0, d - done) + len(kept) * d

    # A storm alert already sends the astronaut home (mission-control abort): no suggestion on top.
    if state.get("storm_alert"):
        return out("none", "storm_alert", rem, p["dwell_min"], need(rem, p["dwell_min"]))

    for k in range(len(rem) + 1):
        best = None
        # combinations() yields the subsets that keep earlier stops first; only a strictly better
        # (dwell, margin) replaces the best, so a tie keeps the earlier stops.
        for kept in itertools.combinations(rem, len(rem) - k):
            kept = list(kept)
            w = walk_time(start, kept, lead, legs) / f
            d = longest_dwell(deadline - t - w, 1 + len(kept), done, p)
            if d is None:
                continue
            key = (d, round(deadline - (t + need(kept, d)), 2))
            if best is None or key > best[0]:
                best = (key, kept, d)
        if best:
            _, kept, d = best
            if k == 0 and d == p["dwell_min"]:
                return out("none", "plan_fits", kept, d, need(kept, d))
            return out("shorten_dwells" if k == 0 else "drop_stops", None, kept, d, need(kept, d))
    return out("go_home_now", None, [], 0, state["home_now_min"] / f)


# ---------------------------------------------------------------- geometry

def lead_on_leg(path: list, x: float, y: float, leg_time_min: float) -> float:
    """lead_min = leg time x remaining path length / leg path length, from the point of the leg's
    path nearest to (x, y)."""
    seg = [math.dist(a[:2], b[:2]) for a, b in zip(path[:-1], path[1:])]
    total, best, acc = sum(seg), (math.inf, 0.0), 0.0
    for (a, b), L in zip(zip(path[:-1], path[1:]), seg):
        u = 0.0 if L == 0 else max(0.0, min(1.0, ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / L ** 2))
        px, py = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        dd = math.hypot(px - x, py - y)
        if dd < best[0]:
            best = (dd, acc + u * L)
        acc += L
    return leg_time_min * (total - best[1]) / total if total else 0.0


def point_along(path: list, frac: float) -> tuple[float, float]:
    """Point at a fraction of a polyline's length."""
    seg = [math.dist(a[:2], b[:2]) for a, b in zip(path[:-1], path[1:])]
    goal, acc = frac * sum(seg), 0.0
    for (a, b), L in zip(zip(path[:-1], path[1:]), seg):
        if acc + L >= goal and L > 0:
            u = (goal - acc) / L
            return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        acc += L
    return float(path[-1][0]), float(path[-1][1])


# ---------------------------------------------------------------- data from the live planner

def post_route(url: str, stops: list[str], return_home: bool) -> dict:
    req = urllib.request.Request(url, json.dumps({"stops": stops, "return_home": return_home}).encode(),
                                 {"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def fetch(url: str, stops: list[str], planner_commit: str) -> dict:
    """The planned route plus a leg table: every pair i<j in plan order, every haven -> stop and
    every stop -> haven, each from POST /route (the first leg haven -> a of a pair call is ignored)."""
    route = post_route(url, stops, True)
    legs_min: dict = {HAVEN: {}}
    legs_m: dict = {HAVEN: {}}
    for i, a in enumerate(stops):
        out, home = post_route(url, [a], True)["legs"]
        legs_min[HAVEN][a], legs_m[HAVEN][a] = out["time_min"], out["distance_m"]
        legs_min[a], legs_m[a] = {HAVEN: home["time_min"]}, {HAVEN: home["distance_m"]}
        for b in stops[i + 1:]:
            leg = post_route(url, [a, b], False)["legs"][1]
            legs_min[a][b], legs_m[a][b] = leg["time_min"], leg["distance_m"]
    return {"fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "planner_url": url, "planner_commit": planner_commit,
            "planner_commit_note": "The live planner does not report its commit. This is the last commit "
                                   "touching planner/ on origin/main at fetch time; that code, run locally on "
                                   "the asset host's rasters, gave the same route (see cross_check).",
            "stops": stops, "request": {"stops": stops, "return_home": True}, "route": route,
            "legs_min": legs_min, "legs_m": legs_m}


def arrivals(route: dict) -> dict:
    """Arrival time at each stop on the nominal plan."""
    return {it["stop"]: it["t0_min"] for it in route["timeline"] if it["kind"] == "dwell"}


def load_params(path: Path) -> dict:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {k: raw[k]["value"] for k in ("budget_min", "reserve_min", "dwell_min", "min_dwell_min")}


# ---------------------------------------------------------------- cases for the web port

CONSOLE = {
    "provenance": "Simulation",
    "note": "Console what-if controls; values are team choices, not measurements.",
    "speed_factor": {"default": 0.5, "min": 0.3, "max": 1.0, "step": 0.1},
    "leak_min": {"default": 120, "min": 0, "max": 180, "step": 10},
}

MATCHING = {"exact": ["action", "reason", "kept", "dropped", "dwell_min"],
            "tolerance_min": {"margin_min": 0.5, "reserve_left_min": 0.5, "end_min": 0.5}}


def build_cases(data: dict, aoi: dict, p: dict, cost_to_home_at) -> list[dict]:
    """Scenarios on the real route. `cost_to_home_at(x, y)` reads cost_to_home_2m.f32."""
    R, legs = data["route"], data["legs_min"]
    order = data["stops"]
    xy = {s["id"]: tuple(s["xy"]) for s in aoi["stops"]}
    arr = arrivals(R)

    def at_stop(stop, t, done=0.0, **trig):
        x, y = xy[stop]
        return {"t_min": round(t, 2), "current_stop": stop, "x_m": x, "y_m": y, "lead_min": 0.0,
                "dwell_done_min": done, "remaining": order[order.index(stop) + 1:],
                "home_now_min": round(cost_to_home_at(x, y), 2), **trig}

    def on_leg(frm, to, frac, **trig):
        leg = next(l for l in R["legs"] if l["from"] == frm and l["to"] == to)
        x, y = point_along(leg["path"], frac)
        lead = lead_on_leg(leg["path"], x, y, leg["time_min"])
        t = arr[frm] + p["dwell_min"] + (leg["time_min"] - lead)
        return {"t_min": round(t, 2), "current_stop": to, "x_m": round(x, 1), "y_m": round(y, 1),
                "lead_min": round(lead, 2), "dwell_done_min": 0.0, "remaining": order[order.index(to) + 1:],
                "home_now_min": round(cost_to_home_at(x, y), 2), **trig}

    specs = [
        ("nominal", "No trigger at Tuff Cliff: the plan fits.", at_stop("tuff-cliff", arr["tuff-cliff"])),
        ("dust-0.5-mount-washburn", "Dust: half walking speed from the Mount Washburn arrival on.",
         at_stop("mount-washburn", arr["mount-washburn"], speed_factor=0.5)),
        ("dust-0.4-mount-washburn", "Heavier dust: 0.4 of the planned walking speed.",
         at_stop("mount-washburn", arr["mount-washburn"], speed_factor=0.4)),
        ("dust-0.5-mid-leg", "Dust starts halfway (by path length) from Tuff Cliff to Bright Angel.",
         on_leg("tuff-cliff", "bright-angel", 0.5, speed_factor=0.5)),
        ("leak-90-tuff-cliff", "Suit leak takes 90 min off the budget at Tuff Cliff.",
         at_stop("tuff-cliff", arr["tuff-cliff"], leak_min=90)),
        ("leak-120-bright-angel", "Suit leak takes 120 min off the budget at Bright Angel.",
         at_stop("bright-angel", arr["bright-angel"], leak_min=120)),
        ("leak-120-during-dwell", "The same leak 10 min into the Bright Angel dwell.",
         at_stop("bright-angel", arr["bright-angel"] + 10, done=10.0, leak_min=120)),
        ("leak-150-cheyava-falls", "Large leak at Cheyava Falls: nothing fits, go home now.",
         at_stop("cheyava-falls", arr["cheyava-falls"], leak_min=150)),
        ("leak-150-dust-0.5-cheyava-falls", "Large leak and dust: the walk home is slower too.",
         at_stop("cheyava-falls", arr["cheyava-falls"], leak_min=150, speed_factor=0.5)),
        ("dust-0.6-leak-60-mount-washburn", "Both triggers, mild: speed 0.6 and a 60 min leak.",
         at_stop("mount-washburn", arr["mount-washburn"], speed_factor=0.6, leak_min=60)),
        ("storm-alert", "Storm alert active (mission-control abort): no suggestion, even with a leak.",
         at_stop("cheyava-falls", arr["cheyava-falls"], leak_min=150, storm_alert=True)),
    ]
    return [{"id": i, "what": w, "provenance": "Simulation", "planner_commit": data["planner_commit"],
             "params": dict(p), "input": s, "expected": decide(s, legs, p)} for i, w, s in specs]

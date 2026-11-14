"""Task MPC-1: receding-horizon replanning, the rule behind the console suggestion.

The walk is planned once (planner POST /route). During the walk two what-if controls can shrink the
time left: a suit leak (the consumables budget drops) and dust / low visibility (walking slows by a
speed factor). The rule re-checks the rest of the plan and suggests the smallest change that still
gets the astronaut home with the reserve intact:

1. Plan still fits (t + remaining time <= deadline): no suggestion.
2. Shorten the remaining dwells, all by the same amount, not below min_dwell_min.
3. Drop one remaining stop (try each, keep the order of the others), then two, and so on; dwells may
   be shortened too. Most stops kept wins; then the longest dwell; then the larger margin.
4. Nothing fits: go home now.

Stops are never reordered. Between stops the astronaut walks on to the next stop: a stop can be
dropped only on arrival or later, never mid-leg (the planner routes between stops, not from an
arbitrary point); "go home now" is always available and uses cost_to_home at the current position.

`decide` has no dependencies, so the web port can follow it line by line.
"""

from __future__ import annotations

import itertools
import json
import math
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


# ---------------------------------------------------------------- the rule

def plan_time(start: str, kept: list[str], lead_min: float, walk: dict, home: dict) -> float:
    """Nominal walking minutes (speed factor 1): lead to `start`, start -> kept stops -> haven."""
    t, at = lead_min, start
    for s in kept:
        t += walk[at][s]
        at = s
    return t + home[at]


def best_dwell(spare: float, n: int, dwell_done: float, dwell_min: float, min_dwell: float) -> float | None:
    """Longest equal dwell d (whole minutes, min_dwell..dwell_min) with n dwells fitting in `spare`.
    The first dwell (the stop the astronaut is at or walking to) already ran for dwell_done minutes."""
    d = math.floor(dwell_min)
    while d >= min_dwell:
        if max(0.0, d - dwell_done) + (n - 1) * d <= spare + 1e-9:
            return float(d)
        d -= 1
    return None


def decide(state: dict, walk: dict, home: dict, p: dict) -> dict:
    """Suggestion for the rest of the walk.

    state: t_min (elapsed), start (stop the astronaut is at, or walking to), lead_min (nominal
      walking minutes left until `start`, 0 when there), dwell_done_min (minutes already spent at
      `start`), remaining (stop ids after `start`, in plan order), home_now_min (nominal walking
      minutes home from the current position: cost_to_home there), speed_factor (1 = nominal),
      leak_min (minutes the suit leak took off the budget).
    walk[a][b]: nominal walking minutes between stops a -> b (a before b in plan order).
    home[a]: nominal walking minutes from stop a to the safe haven.
    p: budget_min, reserve_min, dwell_min, min_dwell_min.
    """
    t, f = state["t_min"], state.get("speed_factor", 1.0)
    deadline = p["budget_min"] - state.get("leak_min", 0.0) - p["reserve_min"]
    start, rem = state["start"], list(state["remaining"])
    done = state.get("dwell_done_min", 0.0)

    def result(action, kept, dwell, end):
        margin = round(deadline - end, 1)
        return {"action": action, "deadline_min": round(deadline, 1), "kept": kept,
                "dropped": [s for s in rem if s not in kept], "dwell_min": dwell,
                "end_min": round(end, 1), "margin_min": margin,
                "reserve_at_home_min": round(p["reserve_min"] + margin, 1)}

    for k in range(len(rem) + 1):
        best = None
        for kept in itertools.combinations(rem, len(rem) - k):
            kept = list(kept)
            w = plan_time(start, kept, state.get("lead_min", 0.0), walk, home) / f
            n = 1 + len(kept)
            d = best_dwell(deadline - t - w, n, done, p["dwell_min"], p["min_dwell_min"])
            if d is None:
                continue
            end = t + w + max(0.0, d - done) + (n - 1) * d
            key = (d, deadline - end)
            if best is None or key > best[0]:
                best = (key, kept, d, end)
        if best:
            _, kept, d, end = best
            if k == 0 and d >= p["dwell_min"]:
                action = "none"
            elif k == 0:
                action = "shorten_dwells"
            else:
                action = "drop_stops"
            return result(action, kept, d, end)
    return result("go_home_now", [], 0.0, t + state["home_now_min"] / f)


# ---------------------------------------------------------------- data from the live planner

def post_route(url: str, stops: list[str], return_home: bool) -> dict:
    req = urllib.request.Request(url, json.dumps({"stops": stops, "return_home": return_home}).encode(),
                                 {"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def fetch_route(url: str, stops: list[str]) -> dict:
    """The planned route plus the walking time of every forward pair of stops and of every stop home.
    Pairs come from POST /route with [a, b] (the first leg haven -> a is ignored)."""
    out = {"fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "planner": url,
           "stops": stops, "route": post_route(url, stops, True), "walk_min": {}, "home_min": {}}
    for i, a in enumerate(stops):
        legs = post_route(url, [a], True)["legs"]
        out["home_min"][a] = legs[1]["time_min"]
        out["walk_min"][a] = {}
        for b in stops[i + 1:]:
            out["walk_min"][a][b] = post_route(url, [a, b], False)["legs"][1]["time_min"]
    return out


def timeline(route: dict) -> list[dict]:
    """Arrival time at each stop on the nominal plan."""
    return [{"stop": it["stop"], "arrive_min": it["t0_min"]} for it in route["timeline"] if it["kind"] == "dwell"]


def state_at_stop(route: dict, stop: str, t_min: float, home: dict, dwell_done: float = 0.0, **trig) -> dict:
    stops = [s["stop"] for s in timeline(route)]
    i = stops.index(stop)
    return {"t_min": t_min, "start": stop, "lead_min": 0.0, "dwell_done_min": dwell_done,
            "remaining": stops[i + 1:], "home_now_min": home[stop], **trig}


def state_on_leg(route: dict, to: str, t_min: float, lead_min: float, home_now_min: float, **trig) -> dict:
    stops = [s["stop"] for s in timeline(route)]
    i = stops.index(to)
    return {"t_min": t_min, "start": to, "lead_min": lead_min, "dwell_done_min": 0.0,
            "remaining": stops[i + 1:], "home_now_min": home_now_min, **trig}


def point_along(path: list, frac: float) -> tuple[float, float]:
    """Point at a fraction of a polyline's length."""
    seg = [math.dist(a, b) for a, b in zip(path[:-1], path[1:])]
    goal, acc = frac * sum(seg), 0.0
    for (a, b), L in zip(zip(path[:-1], path[1:]), seg):
        if acc + L >= goal and L > 0:
            u = (goal - acc) / L
            return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        acc += L
    return tuple(path[-1][:2])


def load_params(path: Path) -> dict:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return {k: raw[k]["value"] for k in ("budget_min", "reserve_min", "dwell_min", "min_dwell_min",
                                         "replan_interval_min") if k in raw}


# ---------------------------------------------------------------- scenarios for the web port

PRESETS = {
    "dust_visibility": {"speed_factor": [0.5, 0.4]},
    "suit_leak": {"leak_min": [90, 120, 150]},
}


def cases(route_data: dict, p: dict, home_on_leg) -> list[dict]:
    """Input state and expected decision per scenario; `home_on_leg(leg_index, frac)` returns the
    nominal minutes home (cost_to_home) at that fraction of a leg's length."""
    R, W, H = route_data["route"], route_data["walk_min"], route_data["home_min"]
    arrive = {a["stop"]: a["arrive_min"] for a in timeline(R)}
    leg_tc_ba = next(i for i, l in enumerate(R["legs"]) if l["from"] == "tuff-cliff")
    half = R["legs"][leg_tc_ba]["time_min"] / 2
    t_mid = arrive["tuff-cliff"] + p["dwell_min"] + half
    specs = [
        ("nominal", "No trigger: the plan fits, no suggestion.",
         state_at_stop(R, "tuff-cliff", arrive["tuff-cliff"], H)),
        ("dust-0.5-at-mount-washburn", "Dust: walking at half speed from Mount Washburn on.",
         state_at_stop(R, "mount-washburn", arrive["mount-washburn"], H, speed_factor=0.5)),
        ("dust-0.4-at-mount-washburn", "Heavier dust: walking at 0.4 of the planned speed.",
         state_at_stop(R, "mount-washburn", arrive["mount-washburn"], H, speed_factor=0.4)),
        ("dust-0.5-mid-leg", "Dust starts halfway between Tuff Cliff and Bright Angel (decided mid-leg).",
         state_on_leg(R, "bright-angel", round(t_mid, 2), round(half, 2), round(home_on_leg(leg_tc_ba, 0.5), 2),
                      speed_factor=0.5)),
        ("leak-90-at-tuff-cliff", "Suit leak takes 90 min off the budget at Tuff Cliff.",
         state_at_stop(R, "tuff-cliff", arrive["tuff-cliff"], H, leak_min=90)),
        ("leak-120-at-bright-angel", "Suit leak takes 120 min off the budget at Bright Angel.",
         state_at_stop(R, "bright-angel", arrive["bright-angel"], H, leak_min=120)),
        ("leak-120-during-dwell", "Same leak, 10 min into the Bright Angel dwell.",
         state_at_stop(R, "bright-angel", arrive["bright-angel"] + 10, H, dwell_done=10, leak_min=120)),
        ("leak-150-at-cheyava-falls", "Large leak at Cheyava Falls: nothing fits, go home now.",
         state_at_stop(R, "cheyava-falls", arrive["cheyava-falls"], H, leak_min=150)),
        ("dust-and-leak", "Both: speed 0.6 and a 60 min leak at Mount Washburn.",
         state_at_stop(R, "mount-washburn", arrive["mount-washburn"], H, speed_factor=0.6, leak_min=60)),
    ]
    return [{"id": i, "what": w, "provenance": "Simulation", "input": s, "expected": decide(s, W, H, p)}
            for i, w, s in specs]

"""Contract check: validates aoi.json and every fixture against contracts/openapi.yaml.

Run: python contracts/check.py   (exit code 0 = pass)
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from PIL import Image
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

ROOT = Path(__file__).resolve().parent
FIX = ROOT / "fixtures"
SPEC_URI = "urn:ariadne:openapi"

spec = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="utf-8"))
registry = Registry().with_resource(SPEC_URI, Resource(contents=spec, specification=DRAFT202012))
errors: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def validate(instance, schema_name: str, where: str) -> bool:
    """Schema-validate; returns False (and records errors) when invalid."""
    before = len(errors)
    schema = {"$ref": f"{SPEC_URI}#/components/schemas/{schema_name}"}
    v = Draft202012Validator(schema, registry=registry, format_checker=Draft202012Validator.FORMAT_CHECKER)
    for e in sorted(v.iter_errors(instance), key=lambda e: list(e.absolute_path)):
        path = "/".join(str(p) for p in e.absolute_path) or "<root>"
        fail(f"{where}: {path}: {e.message}")
    return len(errors) == before


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def check_spec() -> None:
    Draft202012Validator.check_schema({"$defs": spec["components"]["schemas"]})
    for path, item in spec["paths"].items():
        if "servers" not in item:
            fail(f"openapi.yaml: path {path} has no path-level servers entry")


def check_aoi(aoi: dict, where: str) -> None:
    if not validate(aoi, "Aoi", where):
        return
    w, h = aoi["size_m"]
    for key, r in aoi["rasters"].items():
        for dim in (w, h):
            if not math.isclose(dim / r["px_m"], round(dim / r["px_m"])):
                fail(f"{where}: raster {key}: size_m not a multiple of px_m {r['px_m']}")
    for p in [aoi["safe_haven"], *aoi["stops"]]:
        x, y = p["xy"]
        if not (0 <= x <= w and 0 <= y <= h):
            fail(f"{where}: {p['id']} at {p['xy']} is outside size_m {aoi['size_m']}")
    ids = [p["id"] for p in [aoi["safe_haven"], *aoi["stops"]]]
    if len(ids) != len(set(ids)):
        fail(f"{where}: duplicate place ids {ids}")
    slope_legend = aoi["rasters"]["slope"].get("legend", [])
    if not slope_legend or any("max_deg" not in b for b in slope_legend):
        fail(f"{where}: slope.legend must list bins with max_deg")
    elif [b["max_deg"] for b in slope_legend] != sorted(b["max_deg"] for b in slope_legend):
        fail(f"{where}: slope.legend bins must be in ascending max_deg")
    classes = {b.get("class") for b in aoi["rasters"]["traversability"].get("legend", [])}
    if classes != {"go", "caution", "no-go"}:
        fail(f"{where}: traversability.legend must have exactly the classes go, caution, no-go")


def check_rasters(aoi: dict) -> None:
    base = FIX / aoi["assets_base"]
    w, h = aoi["size_m"]
    for key, r in aoi["rasters"].items():
        f = base / r["file"]
        if not f.exists():
            if not r.get("optional"):
                fail(f"fixture raster {key}: missing {f.relative_to(ROOT)}")
            continue
        cols, rows = round(w / r["px_m"]), round(h / r["px_m"])
        if r.get("dtype") == "float32":
            if f.stat().st_size != cols * rows * 4:
                fail(f"fixture raster {key}: {f.stat().st_size} bytes, expected {cols}x{rows}x4")
            side = Path(str(f) + ".json")
            if not side.exists():
                fail(f"fixture raster {key}: sidecar {side.name} missing")
                continue
            meta = load(side)
            if not meta.get("synthetic"):
                fail(f"fixture raster {key}: sidecar {side.name} not marked synthetic")
            for field, want in (("width", cols), ("height", rows), ("px_m", r["px_m"])):
                if meta.get(field) != want:
                    fail(f"fixture raster {key}: sidecar {field}={meta.get(field)}, expected {want}")
            if not all(isinstance(meta.get(k), (int, float)) for k in ("min", "max")):
                fail(f"fixture raster {key}: sidecar needs numeric min and max")
        else:
            with Image.open(f) as im:
                if im.size != (cols, rows):
                    fail(f"fixture raster {key}: {im.size}, expected {(cols, rows)}")
    if "SYNTHETIC" not in (base / "README.md").read_text(encoding="utf-8"):
        fail("fixtures/rasters/README.md must say SYNTHETIC")


def path_len(path) -> float:
    return sum(math.dist(a, b) for a, b in zip(path, path[1:]))


def close(a: float, b: float, tol: float = 0.05) -> bool:
    return abs(a - b) <= tol


def check_route(route: dict, aoi: dict) -> None:
    if not validate(route, "RouteResponse", "fixtures/route.json"):
        return
    places = {p["id"]: p["xy"] for p in [aoi["safe_haven"], *aoi["stops"]]}
    for i, leg in enumerate(route["legs"]):
        for end in ("from", "to"):
            if leg[end] not in places:
                fail(f"route.json leg {i}: unknown {end} id {leg[end]}")
        if leg["from"] in places and leg["path"][0] != places[leg["from"]]:
            fail(f"route.json leg {i}: path does not start at {leg['from']}")
        if leg["to"] in places and leg["path"][-1] != places[leg["to"]]:
            fail(f"route.json leg {i}: path does not end at {leg['to']}")
        if not close(path_len(leg["path"]), leg["distance_m"], 0.5):
            fail(f"route.json leg {i}: distance_m {leg['distance_m']} != path length {path_len(leg['path']):.2f}")
    t = 0.0
    walk = dwell = 0.0
    for item in route["timeline"]:
        if not close(item["t0_min"], t):
            fail(f"route.json timeline gap/overlap at t={item['t0_min']}")
        d = item["t1_min"] - item["t0_min"]
        if item["kind"] == "walk":
            walk += d
            if not close(d, route["legs"][item["leg"]]["time_min"]):
                fail(f"route.json timeline walk leg {item['leg']} duration != leg time_min")
        else:
            dwell += d
            if item.get("stop") not in places:
                fail(f"route.json timeline dwell at unknown stop {item.get('stop')}")
        t = item["t1_min"]
    tot = route["totals"]
    if not close(tot["distance_m"], sum(l["distance_m"] for l in route["legs"])):
        fail("route.json totals.distance_m != sum of legs")
    if not close(tot["walk_min"], walk) or not close(tot["dwell_min"], dwell):
        fail("route.json totals walk/dwell do not match timeline")
    if not close(tot["eva_min"], tot["walk_min"] + tot["dwell_min"]):
        fail("route.json totals.eva_min != walk_min + dwell_min")


def check_abort(ab: dict, aoi: dict) -> None:
    if not validate(ab, "AbortResponse", "fixtures/abort.json"):
        return
    if ab["path"][-1] != aoi["safe_haven"]["xy"]:
        fail("abort.json: path must end at the safe haven")
    if not close(path_len(ab["path"]), ab["distance_m"], 0.5):
        fail("abort.json: distance_m != path length")


def check_conditions(c: dict) -> None:
    if not validate(c, "Conditions", "fixtures/conditions.json"):
        return
    for part in ("weather", "radiation", "space_weather", "partner"):
        if c.get(part) is None and part not in c.get("missing", {}):
            fail(f"conditions.json: {part} is null without a reason in missing")
        if c.get(part) is not None and part in c.get("missing", {}):
            fail(f"conditions.json: {part} is present but also listed in missing")


def check_ws(aoi: dict) -> None:
    lines = (FIX / "ws-state.jsonl").read_text(encoding="utf-8").splitlines()
    ids = {s["id"] for s in aoi["stops"]}
    states = 0
    saw_alert = False
    for n, line in enumerate(lines, 1):
        msg = json.loads(line)
        if not validate(msg, "WsServerMessage", f"ws-state.jsonl:{n}"):
            continue
        if msg["type"] == "state":
            states += 1
            saw_alert |= msg["alert"] is not None
            for s in msg["visited"] + ([msg["at_stop"]] if msg["at_stop"] else []):
                if s not in ids:
                    fail(f"ws-state.jsonl:{n}: unknown stop id {s}")
    if states < 50:
        fail(f"ws-state.jsonl: only {states} state ticks, expected about 60")
    if not saw_alert:
        fail("ws-state.jsonl: no tick with an active alert")


def check_stops(stops: list, aoi: dict) -> None:
    ids = {s["id"] for s in aoi["stops"]}
    for i, s in enumerate(stops):
        if validate(s, "StopContent", f"fixtures/stops.json[{i}]") and s["kind"] == "stop" and s["id"] not in ids:
            fail(f"stops.json[{i}]: stop id {s.get('id')} not in fixture aoi stops")


def main() -> int:
    check_spec()
    check_aoi(load(ROOT / "aoi.json"), "aoi.json")
    fx_aoi = load(FIX / "aoi.json")
    check_aoi(fx_aoi, "fixtures/aoi.json")
    if errors:  # everything below relies on a valid fixture aoi
        return report()
    check_rasters(fx_aoi)
    check_route(load(FIX / "route.json"), fx_aoi)
    check_abort(load(FIX / "abort.json"), fx_aoi)
    check_conditions(load(FIX / "conditions.json"))
    check_ws(fx_aoi)
    check_stops(load(FIX / "stops.json"), fx_aoi)
    # Example request bodies from the spec, so they stay valid too.
    validate({"stops": ["s1", "s2"], "return_home": True}, "RouteRequest", "example RouteRequest")
    validate({"from": [300, 240]}, "AbortRequest", "example AbortRequest")
    validate({"route": load(FIX / "route.json"), "budget_min": 240, "reserve_min": 30, "dwell_min": 20},
             "SessionCreate", "example SessionCreate")
    validate({"type": "hello", "role": "cuff"}, "WsHello", "example WsHello")
    validate({"name": "demo90"}, "SessionScript", "example SessionScript")
    validate({"detail": "stop s9 is unreachable"}, "Error", "example Error (message)")
    validate({"detail": [{"loc": ["body", "stops"], "msg": "field required", "type": "missing"}]},
             "Error", "example Error (FastAPI 422)")

    return report()


def report() -> int:
    if errors:
        print(f"contracts check FAILED ({len(errors)} problems):")
        for e in errors:
            print("  -", e)
        return 1
    print("contracts check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

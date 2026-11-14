"""Generate the SYNTHETIC fixture rasters and ws-state.jsonl.

Everything written here is fake data for development only. Inputs are the hand-made
fixtures/aoi.json and fixtures/route.json; outputs:

  fixtures/rasters/*.jpg|*.png|*.f32 (+ .json sidecars for .f32)
  fixtures/ws-state.jsonl

Run: python contracts/tools/make_fixtures.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from PIL.PngImagePlugin import PngInfo

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / "fixtures"
RASTERS = FIX / "rasters"
LABEL = "SYNTHETIC"
WALK_M_PER_MIN = 50.0  # Assumed, fixtures only (see docs/DATA_SOURCES.md)


def load(name: str):
    return json.loads((FIX / name).read_text(encoding="utf-8"))


AOI = load("aoi.json")
W_M, H_M = AOI["size_m"]
HAVEN = np.array(AOI["safe_haven"]["xy"], dtype=float)


def grid(px_m: float):
    """Pixel-centre coordinates. Row 0 is the north edge."""
    w, h = round(W_M / px_m), round(H_M / px_m)
    x = (np.arange(w) + 0.5) * px_m
    y = H_M - (np.arange(h) + 0.5) * px_m
    return np.meshgrid(x, y)  # each (h, w)


def elevation(x, y):
    """Tilted plane plus one hill well away from the fixture route."""
    plane = -2550.0 + 0.05 * x + 0.02 * y
    hill = 20.0 * np.exp(-((x - 400.0) ** 2 + (y - 100.0) ** 2) / (2 * 30.0**2))
    return plane + hill


def slope_deg(x, y, d=0.5):
    dzdx = (elevation(x + d, y) - elevation(x - d, y)) / (2 * d)
    dzdy = (elevation(x, y + d) - elevation(x, y - d)) / (2 * d)
    return np.degrees(np.arctan(np.hypot(dzdx, dzdy))), dzdx, dzdy


def stamp(img: Image.Image) -> Image.Image:
    """Burn the SYNTHETIC label into the image in a repeating grid."""
    draw = ImageDraw.Draw(img)
    size = max(10, img.width // 25)
    try:
        font = ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        font = ImageFont.load_default()
    fill = 255 if img.mode == "L" else (255, 255, 255)
    step_x, step_y = max(img.width // 3, 1), max(img.height // 3, 1)
    for gy in range(3):
        for gx in range(3):
            draw.text((gx * step_x + 4, gy * step_y + 4), LABEL, fill=fill, font=font)
    return img


def png_info() -> PngInfo:
    info = PngInfo()
    info.add_text("Description", "SYNTHETIC fixture raster, not real data")
    info.add_text("Provenance", "Simulation")
    return info


def write_f32(name: str, arr: np.ndarray, px_m: float, unit: str, formula: str):
    arr.astype("<f4").tofile(RASTERS / name)
    sidecar = {
        "synthetic": True,
        "label": LABEL,
        "width": int(arr.shape[1]),
        "height": int(arr.shape[0]),
        "px_m": px_m,
        "dtype": "float32",
        "byte_order": "little",
        "layout": "row-major, row 0 = north edge, no header",
        "unit": unit,
        "formula": formula,
        "provenance": "Simulation",
    }
    (RASTERS / f"{name}.json").write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8", newline="\n")


def rasters():
    RASTERS.mkdir(parents=True, exist_ok=True)
    r = AOI["rasters"]

    # Orthoimages: colour gradient (red grows east, green grows north).
    for key in ("ortho", "ortho_small"):
        px = r[key]["px_m"]
        x, y = grid(px)
        rgb = np.stack([60 + 140 * x / W_M, 60 + 140 * y / H_M, np.full_like(x, 90)], axis=-1)
        img = stamp(Image.fromarray(rgb.astype(np.uint8), "RGB"))
        img.save(RASTERS / r[key]["file"], quality=85, comment=b"SYNTHETIC fixture raster, not real data")

    # DEM
    px = r["dem"]["px_m"]
    x, y = grid(px)
    write_f32(r["dem"]["file"], elevation(x, y), px, "m",
              "-2550 + 0.05*x + 0.02*y + 20*exp(-((x-400)^2+(y-100)^2)/(2*30^2))")

    # Hillshade (sun azimuth 315, altitude 45)
    px = r["hillshade"]["px_m"]
    x, y = grid(px)
    _, dzdx, dzdy = slope_deg(x, y)
    az, alt = math.radians(315), math.radians(45)
    sx, sy, sz = math.sin(az) * math.cos(alt), math.cos(az) * math.cos(alt), math.sin(alt)
    shade = (-dzdx * sx - dzdy * sy + sz) / np.sqrt(dzdx**2 + dzdy**2 + 1)
    img = stamp(Image.fromarray((np.clip(shade, 0, 1) * 255).astype(np.uint8), "L"))
    img.save(RASTERS / r["hillshade"]["file"], pnginfo=png_info())

    # Slope: RGB coloured with the legend bins
    px = r["slope"]["px_m"]
    x, y = grid(px)
    s, _, _ = slope_deg(x, y)
    rgb = np.zeros(s.shape + (3,), dtype=np.uint8)
    lower = -1.0
    for b in r["slope"]["legend"]:
        c = tuple(int(b["color"][i:i + 2], 16) for i in (1, 3, 5))
        rgb[(s > lower) & (s <= b["max_deg"])] = c
        lower = b["max_deg"]
    stamp(Image.fromarray(rgb, "RGB")).save(RASTERS / r["slope"]["file"], pnginfo=png_info())

    # Traversability: 8-bit grey, 255 = easiest, 0 = impassable (slope >= 30 deg)
    px = r["traversability"]["px_m"]
    x, y = grid(px)
    s, _, _ = slope_deg(x, y)
    t = np.clip(255 * (1 - s / 30.0), 0, 255).astype(np.uint8)
    stamp(Image.fromarray(t, "L")).save(RASTERS / r["traversability"]["file"], pnginfo=png_info())

    # Cost to home: straight-line distance to the safe haven / 50 m per min
    px = r["cost_to_home"]["px_m"]
    x, y = grid(px)
    cost = np.hypot(x - HAVEN[0], y - HAVEN[1]) / WALK_M_PER_MIN
    write_f32(r["cost_to_home"]["file"], cost, px, "min",
              "hypot(x - haven_x, y - haven_y) / 50")


def along(path, frac):
    """Point at fraction 0..1 of a polyline's length."""
    pts = [np.array(p, dtype=float) for p in path]
    seg = [np.linalg.norm(b - a) for a, b in zip(pts, pts[1:])]
    target = frac * sum(seg)
    for a, b, l in zip(pts, pts[1:], seg):
        if target <= l or l == 0:
            return a + (b - a) * (target / l if l else 0)
        target -= l
    return pts[-1]


def ws_stream():
    """60 one-minute ticks: route, a storm alert at t=30 while dwelling at s2, abort home, clear."""
    route = load("route.json")
    legs = route["legs"]
    tl = route["timeline"]
    alert_t, lead = 30.0, 25.0
    abort_path = [legs[1]["path"][-1], legs[0]["path"][1], AOI["safe_haven"]["xy"]]
    abort_len = sum(math.dist(a, b) for a, b in zip(abort_path, abort_path[1:]))
    home_t = alert_t + abort_len / WALK_M_PER_MIN
    clear_t = 50.0

    lines = []
    events = {4.0: "arrived", 28.0: "arrived", alert_t: "storm_alert", home_t: "arrived", clear_t: "clear"}
    for i in range(60):
        t = float(i)
        if t in events:
            lines.append({"type": "event", "name": events[t], "t_min": t})
        leg, at_stop, visited = None, None, []
        pos = AOI["safe_haven"]["xy"]
        running = True
        if t < alert_t:
            for item in tl:
                if item["t0_min"] <= t < item["t1_min"] or (item is tl[-1] and t >= item["t1_min"]):
                    if item["kind"] == "walk":
                        leg = item["leg"]
                        frac = (t - item["t0_min"]) / (item["t1_min"] - item["t0_min"])
                        pos = along(legs[leg]["path"], frac).tolist()
                    else:
                        at_stop = item["stop"]
                        pos = next(s["xy"] for s in AOI["stops"] if s["id"] == at_stop)
                    break
            visited = [it["stop"] for it in tl if it["kind"] == "dwell" and it["t1_min"] <= t]
        else:
            visited = [it["stop"] for it in tl if it["kind"] == "dwell"]
            frac = min(1.0, (t - alert_t) / (home_t - alert_t))
            pos = along(abort_path, frac).tolist()
            running = t < home_t
        active = alert_t <= t < clear_t
        lines.append({
            "type": "state", "session": "fx-session", "t_min": t, "running": running, "speed": 1,
            "pos": [round(pos[0], 2), round(pos[1], 2)], "leg": leg, "at_stop": at_stop,
            "visited": visited,
            "alert": {"type": "storm_alert", "lead_min": lead, "since_t": alert_t} if active else None,
            "abort_path": abort_path if active else None,
            "provenance": "Simulation",
        })
    with (FIX / "ws-state.jsonl").open("w", encoding="utf-8", newline="\n") as f:
        for m in lines:
            f.write(json.dumps(m, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    rasters()
    ws_stream()
    print("wrote SYNTHETIC rasters and ws-state.jsonl")

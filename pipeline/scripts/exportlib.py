"""Helpers for the web assets (task A2): resampling, hillshade, .f32 + sidecar, checks."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def block_reduce(a: np.ndarray, k: int, how: str = "mean") -> np.ndarray:
    """Reduce an array by k x k blocks (shape must be divisible by k), ignoring NaN."""
    rows, cols = a.shape
    if rows % k or cols % k:
        raise ValueError(f"shape {a.shape} not divisible by {k}")
    b = a.reshape(rows // k, k, cols // k, k).astype("float64")
    with np.errstate(all="ignore"):
        if how == "mean":
            out = np.nanmean(b, axis=(1, 3))
        elif how == "max":
            out = np.nanmax(b, axis=(1, 3))
        else:
            raise ValueError(how)
    return out


def hillshade(dem: np.ndarray, px_m: float, azimuth_deg: float = 315.0, altitude_deg: float = 45.0) -> np.ndarray:
    """Hillshade 0..255 of a north-up DEM (row 0 north). NaN cells give 0."""
    z = dem.astype("float64")
    dz_dy_rows, dz_dx = np.gradient(z, px_m)
    dz_dy = -dz_dy_rows  # rows grow southward; y grows northward
    slope = np.arctan(np.hypot(dz_dx, dz_dy))
    aspect = np.arctan2(-dz_dx, -dz_dy)  # direction the slope faces, clockwise from north
    az = np.radians(azimuth_deg)
    alt = np.radians(altitude_deg)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    out = np.clip(shade, 0, 1) * 255
    out[~np.isfinite(out)] = 0
    return out.astype("uint8")


def write_f32(path: Path, a: np.ndarray, px_m: float, extra: dict | None = None) -> dict:
    """Little-endian float32, row-major, no header, plus `<file>.json` sidecar."""
    arr = np.ascontiguousarray(a, dtype="<f4")
    arr.tofile(path)
    finite = arr[np.isfinite(arr)]
    meta = {
        "width": int(arr.shape[1]),
        "height": int(arr.shape[0]),
        "px_m": px_m,
        "min": float(finite.min()) if finite.size else None,
        "max": float(finite.max()) if finite.size else None,
        "dtype": "float32",
        "byte_order": "little",
        "nodata": "NaN",
        **(extra or {}),
    }
    Path(f"{path}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def expected_px(size_m: tuple[float, float], px_m: float) -> tuple[int, int]:
    """(cols, rows) a raster entry must have."""
    return round(size_m[0] / px_m), round(size_m[1] / px_m)


def check_f32(path: Path, size_m: tuple[float, float], px_m: float) -> list[str]:
    errs = []
    cols, rows = expected_px(size_m, px_m)
    if not path.exists():
        return [f"{path.name}: missing"]
    if path.stat().st_size != cols * rows * 4:
        errs.append(f"{path.name}: {path.stat().st_size} bytes, expected {cols}x{rows}x4")
    side = Path(f"{path}.json")
    if not side.exists():
        return errs + [f"{side.name}: missing"]
    meta = json.loads(side.read_text(encoding="utf-8"))
    for key, want in (("width", cols), ("height", rows), ("px_m", px_m)):
        if meta.get(key) != want:
            errs.append(f"{side.name}: {key}={meta.get(key)}, expected {want}")
    if not all(isinstance(meta.get(k), (int, float)) for k in ("min", "max")):
        errs.append(f"{side.name}: min and max must be numbers")
    return errs


def check_image(path: Path, size_m: tuple[float, float], px_m: float) -> list[str]:
    from PIL import Image

    if not path.exists():
        return [f"{path.name}: missing"]
    with Image.open(path) as im:
        want = expected_px(size_m, px_m)
        return [] if im.size == want else [f"{path.name}: {im.size}, expected {want}"]

"""Raster I/O and AOI-metre <-> cell conversion.

`.f32` rasters: little-endian float32, row-major, no header, north-up (row 0 = north edge),
width = size_m[0] / px_m. Pixel centre of (row, col): x = (col + 0.5) * px_m,
y = size_m[1] - (row + 0.5) * px_m (root CLAUDE.md).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np


@dataclass(frozen=True)
class Grid:
    values: np.ndarray  # (rows, cols) float32 or float64
    px_m: float
    size_m: tuple[float, float]

    @property
    def shape(self) -> tuple[int, int]:
        return self.values.shape  # type: ignore[return-value]

    def cell(self, x: float, y: float) -> tuple[int, int] | None:
        """(row, col) containing AOI point (x, y); None outside the AOI."""
        w, h = self.size_m
        if not (0 <= x <= w and 0 <= y <= h):
            return None
        rows, cols = self.shape
        row = min(int((h - y) // self.px_m), rows - 1)
        col = min(int(x // self.px_m), cols - 1)
        return row, col

    def centre(self, row: int, col: int) -> tuple[float, float]:
        return (col + 0.5) * self.px_m, self.size_m[1] - (row + 0.5) * self.px_m

    def bilinear(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        """Sample at AOI points with bilinear interpolation between cell centres (edge-clamped)."""
        rows, cols = self.shape
        fc = np.clip(np.asarray(x) / self.px_m - 0.5, 0, cols - 1)
        fr = np.clip((self.size_m[1] - np.asarray(y)) / self.px_m - 0.5, 0, rows - 1)
        c0 = np.minimum(fc.astype(int), max(cols - 2, 0))
        r0 = np.minimum(fr.astype(int), max(rows - 2, 0))
        c1 = np.minimum(c0 + 1, cols - 1)
        r1 = np.minimum(r0 + 1, rows - 1)
        tc, tr = fc - c0, fr - r0
        v = self.values
        top = v[r0, c0] * (1 - tc) + v[r0, c1] * tc
        bot = v[r1, c0] * (1 - tc) + v[r1, c1] * tc
        return top * (1 - tr) + bot * tr


def read_f32(path: Path, px_m: float, size_m: tuple[float, float]) -> Grid:
    cols, rows = round(size_m[0] / px_m), round(size_m[1] / px_m)
    raw = np.fromfile(path, dtype="<f4")
    if raw.size != rows * cols:
        raise ValueError(f"{path.name}: {raw.size} values, expected {cols} x {rows} = {rows * cols}")
    return Grid(raw.reshape(rows, cols), px_m, size_m)

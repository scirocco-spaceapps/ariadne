"""Least-cost paths on the 2 m cost grid.

The cost grid (`cost_2m.f32`, written by pipeline/scripts/04_cost.py) holds the walking time per
metre in minutes; NaN or a non-positive value marks an impassable cell. skimage's MCP_Geometric
adds (c_a + c_b) / 2 * step_length (in pixels) per step, so multiplying by px_m gives minutes.
Cost is isotropic: the same in every direction, no uphill/downhill asymmetry (docs/model.md).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from skimage.graph import MCP_Geometric

from .grid import Grid

MAX_VERTICES = 300  # contracts/openapi.yaml Leg.path and AbortResponse.path


def mcp_costs(cost: Grid) -> np.ndarray:
    """Costs in the form MCP wants: impassable cells become +inf."""
    c = cost.values.astype("float64")
    c[~np.isfinite(c) | (c <= 0)] = np.inf
    return c


@dataclass
class PathResult:
    cells: list[tuple[int, int]]
    time_min: float


def least_cost_path(costs: np.ndarray, px_m: float, start: tuple[int, int], end: tuple[int, int]) -> PathResult | None:
    """Cheapest 8-connected path from start to end; None when end is unreachable."""
    if not (np.isfinite(costs[start]) and np.isfinite(costs[end])):
        return None
    mcp = MCP_Geometric(costs, fully_connected=True)
    cum, _ = mcp.find_costs([start], [end])
    if not np.isfinite(cum[end]):
        return None
    cells = [tuple(int(v) for v in rc) for rc in mcp.traceback(end)]
    return PathResult(cells=cells, time_min=float(cum[end]) * px_m)


class HomeField:
    """One MCP run from the safe haven: cost to home for every cell and the path back."""

    def __init__(self, costs: np.ndarray, px_m: float, haven: tuple[int, int]):
        self.px_m = px_m
        self.haven = haven
        self._mcp = MCP_Geometric(costs, fully_connected=True)
        cum, _ = self._mcp.find_costs([haven])
        self.cost_min = cum * px_m  # inf where unreachable

    def path_home(self, cell: tuple[int, int]) -> PathResult | None:
        t = self.cost_min[cell]
        if not np.isfinite(t):
            return None
        cells = [tuple(int(v) for v in rc) for rc in self._mcp.traceback(cell)]
        return PathResult(cells=cells[::-1], time_min=float(t))


def path_length_m(points: np.ndarray) -> float:
    if len(points) < 2:
        return 0.0
    return float(np.hypot(*np.diff(points, axis=0).T).sum())


def _rdp_mask(points: np.ndarray, eps: float) -> np.ndarray:
    keep = np.zeros(len(points), dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = points[i], points[j]
        seg = points[i + 1 : j]
        ab = b - a
        norm = np.hypot(*ab)
        if norm == 0:
            d = np.hypot(*(seg - a).T)
        else:
            d = np.abs(ab[0] * (seg[:, 1] - a[1]) - ab[1] * (seg[:, 0] - a[0])) / norm
        k = int(np.argmax(d))
        if d[k] > eps:
            m = i + 1 + k
            keep[m] = True
            stack += [(i, m), (m, j)]
    return keep


def simplify(points: np.ndarray, px_m: float, max_vertices: int = MAX_VERTICES) -> np.ndarray:
    """Ramer-Douglas-Peucker, tolerance starting at half a cell and doubled until <= max_vertices."""
    if len(points) <= 2:
        return points
    eps = px_m / 2
    while True:
        out = points[_rdp_mask(points, eps)]
        if len(out) <= max_vertices:
            return out
        eps *= 2

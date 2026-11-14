"""Cost to home: one minimum-cost run from the safe haven over the 2 m cost grid (task A4).

cost_2m.f32 holds minutes per metre (NaN = impassable). skimage's MCP_Geometric adds
(c_a + c_b) / 2 * step_length_in_pixels per step on an 8-connected grid, so cumulative cost x px_m
is minutes. Impassable cells are +inf for MCP (skimage: infinite or negative costs are impassable).
The planner (planner/app/routing.py) uses the same MCP_Geometric set-up, so its /abort times
match this raster.
"""

from __future__ import annotations

import numpy as np
from skimage.graph import MCP_Geometric


def mcp_costs(cost_min_per_m: np.ndarray) -> np.ndarray:
    c = cost_min_per_m.astype("float64")
    c[~np.isfinite(c) | (c <= 0)] = np.inf
    return c


def cost_to_home(cost_min_per_m: np.ndarray, px_m: float, haven: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    """(minutes to the haven, NaN where unreachable; predecessor linear index toward the haven, -1 at the
    haven and where unreachable)."""
    costs = mcp_costs(cost_min_per_m)
    if not np.isfinite(costs[haven]):
        raise ValueError(f"safe haven cell {haven} is impassable")
    mcp = MCP_Geometric(costs, fully_connected=True)
    cum, tb = mcp.find_costs([haven])
    minutes = cum * px_m
    reach = np.isfinite(minutes)
    minutes[~reach] = np.nan

    rows, cols = costs.shape
    offsets = np.asarray(mcp.offsets)  # tb[i] indexes offsets; predecessor = cell - offset
    rr, cc = np.indices(costs.shape)
    pred = np.full(costs.shape, -1, dtype="int32")
    ok = reach & (tb >= 0)
    ok[haven] = False
    off = offsets[tb[ok]]
    pr, pc = rr[ok] - off[:, 0], cc[ok] - off[:, 1]
    pred[ok] = (pr * cols + pc).astype("int32")
    return minutes.astype("float32"), pred


def path_from(pred: np.ndarray, cell: tuple[int, int], limit: int | None = None) -> list[tuple[int, int]]:
    """Follow predecessors from `cell` to the haven; [] if unreachable."""
    rows, cols = pred.shape
    idx = cell[0] * cols + cell[1]
    out = [cell]
    limit = limit or rows * cols
    while pred.flat[idx] >= 0 and len(out) <= limit:
        idx = int(pred.flat[idx])
        out.append((idx // cols, idx % cols))
    return out

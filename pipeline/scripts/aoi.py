"""AOI frame and local paths shared by every pipeline script.

Frame: contracts/aoi.json (crs.proj4, origin_lonlat, size_m). Until the real origin is merged into
the contract, pipeline/aoi_frame.json may override origin_lonlat (see that file for why).

Coordinates (root CLAUDE.md):
- projected: metres in crs.proj4 (local equirectangular, true scale at the AOI latitude);
- AOI metres: x east, y north, from the AOI south-west corner = projected - projected(origin);
- rasters are north-up, row 0 at the north edge; pixel centre of (row, col):
  x = (col + 0.5) * px_m, y = size_m[1] - (row + 0.5) * px_m.

Paths (environment variables, laptop defaults under ~/ariadne-data):
- ARIADNE_RAW   raw NASA downloads and padded native crops   (~/ariadne-data/raw)
- ARIADNE_WORK  intermediate products in the local CRS        (~/ariadne-data/work)
- DATA_DIR      published assets; files go to DATA_DIR/<assets_base><file>  (~/ariadne-data/assets)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from pyproj import CRS, Transformer

REPO = Path(__file__).resolve().parents[2]
CONTRACT_AOI = REPO / "contracts" / "aoi.json"
FRAME_OVERRIDE = REPO / "pipeline" / "aoi_frame.json"

# Mars 2000 IAU sphere, the datum of the USGS products and of crs.proj4.
MARS_LONLAT = "+proj=longlat +R=3396190 +no_defs"


def _dir(env: str, default: str) -> Path:
    return Path(os.environ.get(env) or Path.home() / "ariadne-data" / default).expanduser()


RAW_DIR = _dir("ARIADNE_RAW", "raw")
WORK_DIR = _dir("ARIADNE_WORK", "work")
DATA_DIR = _dir("DATA_DIR", "assets")


@dataclass(frozen=True)
class Frame:
    proj4: str
    origin_lonlat: tuple[float, float]
    size_m: tuple[float, float]
    assets_base: str

    @property
    def _fwd(self) -> Transformer:
        return Transformer.from_crs(CRS.from_proj4(MARS_LONLAT), CRS.from_proj4(self.proj4), always_xy=True)

    @property
    def _inv(self) -> Transformer:
        return Transformer.from_crs(CRS.from_proj4(self.proj4), CRS.from_proj4(MARS_LONLAT), always_xy=True)

    @property
    def origin_proj(self) -> tuple[float, float]:
        """Projected coordinates of the AOI south-west corner."""
        x, y = self._fwd.transform(*self.origin_lonlat)
        return float(x), float(y)

    @property
    def bounds_proj(self) -> tuple[float, float, float, float]:
        """(xmin, ymin, xmax, ymax) in projected metres, for gdalwarp -te."""
        x0, y0 = self.origin_proj
        return x0, y0, x0 + self.size_m[0], y0 + self.size_m[1]

    def lonlat_to_aoi(self, lon, lat):
        """Mars lon/lat (degrees, east-positive) -> AOI metres. Accepts scalars or arrays."""
        x, y = self._fwd.transform(np.asarray(lon, dtype="float64"), np.asarray(lat, dtype="float64"))
        x0, y0 = self.origin_proj
        return x - x0, y - y0

    def aoi_to_lonlat(self, x, y):
        x0, y0 = self.origin_proj
        return self._inv.transform(np.asarray(x, dtype="float64") + x0, np.asarray(y, dtype="float64") + y0)

    def inside(self, x: float, y: float) -> bool:
        return 0.0 <= x <= self.size_m[0] and 0.0 <= y <= self.size_m[1]


def load_frame(contract: Path = CONTRACT_AOI, override: Path | None = FRAME_OVERRIDE) -> Frame:
    aoi = json.loads(contract.read_text(encoding="utf-8"))
    origin = aoi["origin_lonlat"]
    if override is not None and override.exists():
        origin = json.loads(override.read_text(encoding="utf-8")).get("origin_lonlat", origin)
    return Frame(
        proj4=aoi["crs"]["proj4"],
        origin_lonlat=(float(origin[0]), float(origin[1])),
        size_m=(float(aoi["size_m"][0]), float(aoi["size_m"][1])),
        assets_base=aoi["assets_base"],
    )


def pixel_centre(row: int, col: int, px_m: float, height_m: float) -> tuple[float, float]:
    return (col + 0.5) * px_m, height_m - (row + 0.5) * px_m


def xy_to_pixel(x: float, y: float, px_m: float, height_m: float) -> tuple[int, int]:
    """AOI metres -> (row, col) of the containing cell, north-up."""
    return int((height_m - y) // px_m), int(x // px_m)


if __name__ == "__main__":
    # Used by 01_crop.sh: print proj4 and the projected bounds.
    import sys

    f = load_frame()
    if sys.argv[1:] == ["--te"]:
        print(" ".join(f"{v:.3f}" for v in f.bounds_proj))
    elif sys.argv[1:] == ["--proj4"]:
        print(f.proj4)
    else:
        print(json.dumps({"proj4": f.proj4, "origin_lonlat": f.origin_lonlat, "size_m": f.size_m,
                          "bounds_proj": f.bounds_proj}, indent=2))

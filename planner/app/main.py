"""Ariadne planner service. Contract: contracts/openapi.yaml (tag planner).

Env: DATA_DIR (assets root, default /srv/assets), AOI_PATH (default DATA_DIR/aoi.json),
WEB_ORIGIN (comma-separated CORS origins, default http://localhost:5173).
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from . import plan

log = logging.getLogger("uvicorn.error")

XY = Annotated[list[float], Field(min_length=2, max_length=2)]


class RouteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stops: list[str] = Field(min_length=1)
    return_home: bool


class AbortRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    from_: XY = Field(alias="from")


class State:
    data: plan.PlannerData | None = None
    error: str | None = None


state = State()


def load_data() -> None:
    data_dir, aoi_path = plan.data_paths()
    t0 = time.perf_counter()
    try:
        state.data, state.error = plan.load(data_dir, aoi_path), None
        log.info("planner data loaded from %s in %.1f s", data_dir, time.perf_counter() - t0)
    except (OSError, ValueError, KeyError) as e:
        state.data, state.error = None, f"planner data not loaded: {e}"
        log.error(state.error)


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_data()
    yield


app = FastAPI(title="Ariadne planner", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("WEB_ORIGIN", "http://localhost:5173").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(plan.PlanError)
async def plan_error(_: Request, exc: plan.PlanError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


def _data() -> plan.PlannerData:
    if state.data is None:
        raise plan.PlanError(state.error or "planner data not loaded")
    return state.data


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "planner"}


@app.post("/route")
def route(req: RouteRequest) -> dict:
    return plan.plan_route(_data(), req.stops, req.return_home)


@app.post("/abort")
def abort(req: AbortRequest) -> dict:
    return plan.plan_abort(_data(), (req.from_[0], req.from_[1]))

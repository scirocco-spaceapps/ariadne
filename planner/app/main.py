"""Ariadne planner service. Contract: contracts/openapi.yaml (tag planner)."""

from fastapi import FastAPI

app = FastAPI(title="Ariadne planner", version="0.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "planner"}

import time

import pytest

from app import main


def test_too_many_stops_is_422(client):
    r = client.post("/route", json={"stops": ["s1"] * (main.MAX_STOPS + 1), "return_home": False})
    assert r.status_code == 422
    assert "at most" in r.json()["detail"]


def test_slow_computation_answers_422_after_timeout(client, monkeypatch):
    monkeypatch.setenv("PLANNER_TIMEOUT_S", "0.05")
    real = main.plan.plan_abort

    def slow(*a):
        time.sleep(0.3)
        return real(*a)

    monkeypatch.setattr(main.plan, "plan_abort", slow)
    r = client.post("/abort", json={"from": [37, 3]})
    assert r.status_code == 422
    assert "longer than" in r.json()["detail"]


@pytest.mark.parametrize("body", ['{"from": [NaN, 1]}', '{"from": [1, Infinity]}'])
def test_non_finite_position_is_422(client, body):
    r = client.post("/abort", content=body, headers={"content-type": "application/json"})
    assert r.status_code == 422


@pytest.mark.parametrize("body", [{"from": ["a", 1]}, {"from": None}, {"stops": "s1", "return_home": True}])
def test_wrong_types_are_422(client, body):
    path = "/abort" if "from" in body else "/route"
    assert client.post(path, json=body).status_code == 422

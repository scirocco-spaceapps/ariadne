import pytest

from .conftest import SPEED, schema_errors


def test_abort_matches_contract_and_ends_at_haven(client):
    r = client.post("/abort", json={"from": [37, 3]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert schema_errors(body, "AbortResponse") == []
    assert body["provenance"] == "Modeled"
    assert body["path"][0] == [37, 3] and body["path"][-1] == [3, 3]
    assert body["time_min"] == pytest.approx(body["distance_m"] / SPEED, rel=0.05)


def test_abort_time_equals_route_leg_back_home(client):
    leg = client.post("/route", json={"stops": ["s1"], "return_home": True}).json()["legs"][1]
    ab = client.post("/abort", json={"from": [37, 29]}).json()
    assert ab["time_min"] == pytest.approx(leg["time_min"], rel=0.02)


@pytest.mark.parametrize("pos", [[-1, 5], [5, 40], [41, 1]])
def test_abort_outside_aoi_is_422(client, pos):
    r = client.post("/abort", json={"from": pos})
    assert r.status_code == 422
    assert "outside the AOI" in r.json()["detail"]


def test_abort_from_wall_is_422(client):
    r = client.post("/abort", json={"from": [19, 10]})
    assert r.status_code == 422
    assert "no passable path" in r.json()["detail"]


def test_abort_bad_shape_is_422(client):
    assert client.post("/abort", json={"from": [1]}).status_code == 422
    assert client.post("/abort", json={"from": [1, 2, 3]}).status_code == 422
    assert client.post("/abort", json={}).status_code == 422


def test_missing_data_answers_422_but_health_ok(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    with TestClient(app) as c:
        assert c.get("/health").status_code == 200
        r = c.post("/abort", json={"from": [1, 1]})
        assert r.status_code == 422
        assert "planner data not loaded" in r.json()["detail"]

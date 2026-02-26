from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint(monkeypatch):
    from app.api import readings

    monkeypatch.setattr(readings.influx_service, "ping", lambda: False)

    client = TestClient(app)
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["api"] == "ok"
    assert data["influxdb"] == "unavailable"

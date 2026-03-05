from fastapi.testclient import TestClient

from app.main import app


def test_websocket_broadcast_on_ingest(monkeypatch):
    from app.api import readings

    monkeypatch.setattr(readings.influx_service, "ping", lambda: True)
    monkeypatch.setattr(readings.influx_service, "write_reading", lambda payload: None)
    monkeypatch.setattr(readings.influx_service, "query_latest", lambda device_id: None)

    client = TestClient(app)

    with client.websocket_connect("/api/v1/ws/readings?device_id=esp32-001") as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "connected"

        response = client.post(
            "/api/v1/readings",
            json={
                "device_id": "esp32-001",
                "temperature_c": 24.5,
                "humidity_pct": 62.3,
                "pressure_hpa": 1009.2,
                "gas_resistance_ohm": 12400.0,
                "voc_index": 33.8,
                "air_quality_score": 77.5,
                "is_urgent": False,
                "is_heartbeat": False,
                "metadata": {"source": "test"},
            },
        )
        assert response.status_code == 201

        event = websocket.receive_json()
        assert event["type"] == "reading_ingested"
        assert event["data"]["device_id"] == "esp32-001"


def test_websocket_ping_pong(monkeypatch):
    from app.api import readings

    monkeypatch.setattr(readings.influx_service, "ping", lambda: True)
    monkeypatch.setattr(readings.influx_service, "query_latest", lambda device_id: None)

    client = TestClient(app)

    with client.websocket_connect("/api/v1/ws/readings?device_id=esp32-001") as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "connected"

        websocket.send_text("ping")
        pong = websocket.receive_json()
        assert pong["type"] == "pong"

from __future__ import annotations


def _register_device(client):
    response = client.post(
        "/api/v1/devices/register",
        json={"name": "esp32-cam-session", "fw_version": "0.1.0"},
    )
    assert response.status_code == 201
    return response.json()


def _start_session(client, device_id: str):
    response = client.post(
        "/api/v1/sessions/start",
        json={
            "device_id": device_id,
            "screen_w": 1366,
            "screen_h": 768,
            "mode": "mvp",
        },
    )
    assert response.status_code == 201
    return response.json()["session"]


def test_start_session_closes_previous_active(client):
    device = _register_device(client)

    first = _start_session(client, device["id"])
    second = _start_session(client, device["id"])

    first_after = client.get(f"/api/v1/sessions/{first['id']}")
    assert first_after.status_code == 200
    assert first_after.json()["active"] is False
    assert first_after.json()["ended_at"] is not None

    active = client.get(f"/api/v1/sessions/active?device_id={device['id']}")
    assert active.status_code == 200
    assert active.json()["id"] == second["id"]
    assert active.json()["active"] is True


def test_get_active_session_not_found(client):
    device = _register_device(client)
    response = client.get(f"/api/v1/sessions/active?device_id={device['id']}")
    assert response.status_code == 404

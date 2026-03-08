
def test_websocket_live_connect_and_ping(client):
    device = client.post(
        "/api/v1/devices/register",
        json={"name": "esp32-cam-ws", "fw_version": "0.1.0"},
    ).json()

    session = client.post(
        "/api/v1/sessions/start",
        json={
            "device_id": device["id"],
            "screen_w": 1280,
            "screen_h": 720,
            "mode": "mvp",
        },
    ).json()["session"]

    with client.websocket_connect(f"/api/v1/ws/live?session_id={session['id']}") as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "connected"
        assert connected["session_id"] == session["id"]

        websocket.send_text("ping")
        pong = websocket.receive_json()
        assert pong["type"] == "pong"

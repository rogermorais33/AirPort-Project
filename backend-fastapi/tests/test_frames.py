from __future__ import annotations

from datetime import datetime, timezone


JPEG_1X1 = (
    b"\xff\xd8\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c"
    b"\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.'\",#\x1c\x1c(7),01444\x1f'9=82<.342"
    b"\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x03\x01\x22\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01"
    b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00"
    b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00?\x00\xd2\xcf \xff\xd9"
)


def _register_device(client):
    res = client.post("/api/v1/devices/register", json={"name": "esp32-cam-test", "fw_version": "0.1.0"})
    assert res.status_code == 201
    return res.json()


def _start_session(client, device_id: str):
    res = client.post(
        "/api/v1/sessions/start",
        json={
            "device_id": device_id,
            "screen_w": 1366,
            "screen_h": 768,
            "mode": "mvp",
        },
    )
    assert res.status_code == 201
    return res.json()["session"]


def test_frame_ingest_multipart(client):
    device = _register_device(client)
    session = _start_session(client, device["id"])

    ts = datetime.now(timezone.utc).isoformat()
    response = client.post(
        "/api/v1/frames",
        data={
            "session_id": session["id"],
            "ts": ts,
            "device_key": device["device_key"],
        },
        files={"file": ("frame.jpg", JPEG_1X1, "image/jpeg")},
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["status"] == "accepted"
    assert payload["processing_status"] in {"done", "queued"}

    report = client.get(f"/api/v1/reports/session/{session['id']}")
    assert report.status_code == 200
    report_payload = report.json()
    assert report_payload["frames_total"] >= 1

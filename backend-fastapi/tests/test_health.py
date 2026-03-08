def test_health(client):
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["api"] == "ok"
    assert payload["database"] == "ok"
    assert payload["queue_mode"] == "sync"

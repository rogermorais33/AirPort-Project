from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from app.models.sensor import HealthStatus, SensorReadingDB, SensorReadingIn, SensorReadingOut
from app.services.influx import influx_service
from app.services.ws import readings_ws_hub

router = APIRouter(prefix="/api/v1", tags=["sensor"])


@router.get("/health", response_model=HealthStatus)
def healthcheck() -> HealthStatus:
    influx_status = "ok" if influx_service.ping() else "unavailable"
    return HealthStatus(api="ok", influxdb=influx_status)


@router.post("/readings", response_model=SensorReadingOut, status_code=201)
async def ingest_reading(payload: SensorReadingIn) -> SensorReadingOut:
    if not influx_service.ping():
        raise HTTPException(status_code=503, detail="InfluxDB indisponivel")

    try:
        await run_in_threadpool(influx_service.write_reading, payload)
        await readings_ws_hub.broadcast_reading(payload)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao gravar leitura: {exc}") from exc

    return SensorReadingOut(status="ok", message="Leitura registrada com sucesso")


@router.get("/readings/latest", response_model=SensorReadingDB)
def latest_reading(device_id: str = Query(..., min_length=3)) -> SensorReadingDB:
    if not influx_service.ping():
        raise HTTPException(status_code=503, detail="InfluxDB indisponivel")

    result = influx_service.query_latest(device_id=device_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Nenhuma leitura encontrada para o dispositivo")

    return result


@router.get("/readings", response_model=list[SensorReadingDB])
def list_readings(
    device_id: str = Query(..., min_length=3),
    minutes: int = Query(60, ge=1, le=60 * 24 * 30),
    limit: int = Query(200, ge=1, le=2000),
) -> list[SensorReadingDB]:
    if not influx_service.ping():
        raise HTTPException(status_code=503, detail="InfluxDB indisponivel")

    return influx_service.query_readings(device_id=device_id, minutes=minutes, limit=limit)


@router.websocket("/ws/readings")
async def readings_stream(
    websocket: WebSocket,
    device_id: str | None = Query(default=None, min_length=3, max_length=64),
) -> None:
    connected = await readings_ws_hub.connect(websocket, device_id=device_id)
    if not connected:
        return

    try:
        if device_id and influx_service.ping():
            latest = await run_in_threadpool(influx_service.query_latest, device_id)
            if latest is not None:
                await readings_ws_hub.send_message(
                    websocket,
                    {
                        "type": "latest_snapshot",
                        "timestamp": latest.timestamp.isoformat(),
                        "data": latest.model_dump(mode="json"),
                    },
                )

        while True:
            message = await websocket.receive_text()
            if message.strip().lower() == "ping":
                await readings_ws_hub.send_message(
                    websocket,
                    {"type": "pong", "timestamp": latest_utc_iso()},
                )
    except WebSocketDisconnect:
        await readings_ws_hub.disconnect(websocket)
    except Exception:
        await readings_ws_hub.disconnect(websocket)


def latest_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

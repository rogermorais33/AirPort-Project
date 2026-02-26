from fastapi import APIRouter, HTTPException, Query

from app.models.sensor import HealthStatus, SensorReadingDB, SensorReadingIn, SensorReadingOut
from app.services.influx import influx_service

router = APIRouter(prefix="/api/v1", tags=["sensor"])


@router.get("/health", response_model=HealthStatus)
def healthcheck() -> HealthStatus:
    influx_status = "ok" if influx_service.ping() else "unavailable"
    return HealthStatus(api="ok", influxdb=influx_status)


@router.post("/readings", response_model=SensorReadingOut, status_code=201)
def ingest_reading(payload: SensorReadingIn) -> SensorReadingOut:
    if not influx_service.ping():
        raise HTTPException(status_code=503, detail="InfluxDB indisponivel")

    try:
        influx_service.write_reading(payload)
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

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SensorReadingIn(BaseModel):
    device_id: str = Field(..., min_length=3, max_length=64, description="Identificador do ESP32")
    timestamp: datetime = Field(default_factory=utc_now)
    temperature_c: float = Field(..., ge=-40.0, le=125.0)
    humidity_pct: float = Field(..., ge=0.0, le=100.0)
    pressure_hpa: float | None = Field(default=None, ge=300.0, le=1200.0)
    gas_resistance_ohm: float = Field(..., gt=0.0)
    voc_index: float | None = Field(default=None, ge=0.0)
    air_quality_score: float | None = Field(default=None, ge=0.0, le=100.0)
    is_urgent: bool = False
    is_heartbeat: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


class SensorReadingOut(BaseModel):
    status: str
    message: str
    ingestion_time: datetime = Field(default_factory=utc_now)


class SensorReadingDB(BaseModel):
    timestamp: datetime
    device_id: str
    temperature_c: float
    humidity_pct: float
    pressure_hpa: float | None
    gas_resistance_ohm: float
    voc_index: float | None
    air_quality_score: float | None
    is_urgent: bool
    is_heartbeat: bool
    metadata: dict[str, Any]


class HealthStatus(BaseModel):
    api: str
    influxdb: str
    timestamp: datetime = Field(default_factory=utc_now)

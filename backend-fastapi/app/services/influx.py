from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from influxdb_client import BucketsApi, InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

from app.core.config import get_settings
from app.models.sensor import SensorReadingDB, SensorReadingIn


class InfluxService:
    def __init__(self) -> None:
        settings = get_settings()
        self.url = settings.influx_url
        self.token = settings.influx_token
        self.org = settings.influx_org
        self.bucket = settings.influx_bucket
        self.retention_days = settings.influx_retention_days

        self.client = InfluxDBClient(url=self.url, token=self.token, org=self.org, timeout=5000)
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.query_api = self.client.query_api()
        self.buckets_api: BucketsApi = self.client.buckets_api()

    def ping(self) -> bool:
        try:
            return bool(self.client.ping())
        except Exception:
            return False

    def ensure_bucket(self) -> None:
        retention_seconds = max(self.retention_days, 1) * 24 * 3600
        existing = self.buckets_api.find_bucket_by_name(self.bucket)
        if existing is None:
            org = self.client.organizations_api().find_organizations(org=self.org)
            if not org:
                raise RuntimeError(f"Organizacao InfluxDB nao encontrada: {self.org}")
            self.buckets_api.create_bucket(
                bucket_name=self.bucket,
                org_id=org[0].id,
                retention_rules=[{"type": "expire", "everySeconds": retention_seconds}],
            )

    def write_reading(self, payload: SensorReadingIn) -> None:
        p = (
            Point("air_quality")
            .tag("device_id", payload.device_id)
            .field("temperature_c", float(payload.temperature_c))
            .field("humidity_pct", float(payload.humidity_pct))
            .field("gas_resistance_ohm", float(payload.gas_resistance_ohm))
            .field("is_urgent", bool(payload.is_urgent))
            .field("is_heartbeat", bool(payload.is_heartbeat))
            .field("metadata", json.dumps(payload.metadata, ensure_ascii=True))
            .time(payload.timestamp)
        )

        if payload.pressure_hpa is not None:
            p = p.field("pressure_hpa", float(payload.pressure_hpa))
        if payload.voc_index is not None:
            p = p.field("voc_index", float(payload.voc_index))
        if payload.air_quality_score is not None:
            p = p.field("air_quality_score", float(payload.air_quality_score))

        self.write_api.write(bucket=self.bucket, org=self.org, record=p)

    def query_latest(self, device_id: str) -> SensorReadingDB | None:
        query = f'''
from(bucket: "{self.bucket}")
  |> range(start: -30d)
  |> filter(fn: (r) => r["_measurement"] == "air_quality")
  |> filter(fn: (r) => r["device_id"] == "{device_id}")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: 1)
'''
        rows = self.query_api.query(query=query, org=self.org)
        parsed = _parse_flux_rows(rows)
        return parsed[0] if parsed else None

    def query_readings(self, device_id: str, minutes: int, limit: int) -> list[SensorReadingDB]:
        start_at = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        query = f'''
from(bucket: "{self.bucket}")
  |> range(start: {start_at.isoformat()})
  |> filter(fn: (r) => r["_measurement"] == "air_quality")
  |> filter(fn: (r) => r["device_id"] == "{device_id}")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: {limit})
'''
        rows = self.query_api.query(query=query, org=self.org)
        return _parse_flux_rows(rows)


influx_service = InfluxService()


def _parse_flux_rows(tables: list[Any]) -> list[SensorReadingDB]:
    parsed: list[SensorReadingDB] = []

    for table in tables:
        for record in table.records:
            values = record.values
            metadata = values.get("metadata") or "{}"
            try:
                metadata_dict = json.loads(metadata) if isinstance(metadata, str) else {}
            except Exception:
                metadata_dict = {}

            parsed.append(
                SensorReadingDB(
                    timestamp=values.get("_time"),
                    device_id=values.get("device_id"),
                    temperature_c=float(values.get("temperature_c", 0.0)),
                    humidity_pct=float(values.get("humidity_pct", 0.0)),
                    pressure_hpa=_to_optional_float(values.get("pressure_hpa")),
                    gas_resistance_ohm=float(values.get("gas_resistance_ohm", 0.0)),
                    voc_index=_to_optional_float(values.get("voc_index")),
                    air_quality_score=_to_optional_float(values.get("air_quality_score")),
                    is_urgent=bool(values.get("is_urgent", False)),
                    is_heartbeat=bool(values.get("is_heartbeat", False)),
                    metadata=metadata_dict,
                )
            )
    return parsed


def _to_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None

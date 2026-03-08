from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Device


def resolve_device_key(
    form_device_key: str | None,
    header_device_key: str | None,
    query_device_key: str | None,
) -> str:
    device_key = (form_device_key or header_device_key or query_device_key or "").strip()
    if not device_key:
        raise HTTPException(status_code=401, detail="Missing device key")
    return device_key


def get_device_by_key(db: Session, device_key: str) -> Device:
    device = db.scalar(select(Device).where(Device.device_key == device_key))
    if device is None:
        raise HTTPException(status_code=401, detail="Invalid device key")
    return device

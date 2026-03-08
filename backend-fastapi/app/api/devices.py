from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import Device
from app.schemas.devices import (
    DeviceConfigOut,
    DeviceHeartbeatIn,
    DeviceHeartbeatOut,
    DeviceRegisterIn,
    DeviceRegisterOut,
)

router = APIRouter(prefix="/devices", tags=["devices"])
settings = get_settings()


@router.post("/register", response_model=DeviceRegisterOut, status_code=201)
def register_device(payload: DeviceRegisterIn, db: Session = Depends(get_db)) -> DeviceRegisterOut:
    device = Device(
        name=payload.name,
        fw_version=payload.fw_version,
        device_key=_generate_device_key(),
        last_seen_at=datetime.now(timezone.utc),
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return DeviceRegisterOut.model_validate(device)


@router.post("/heartbeat", response_model=DeviceHeartbeatOut)
async def heartbeat(
    payload: DeviceHeartbeatIn,
    request: Request,
    db: Session = Depends(get_db),
) -> DeviceHeartbeatOut:
    device = db.get(Device, payload.device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    if device.device_key != payload.device_key:
        raise HTTPException(status_code=401, detail="Invalid device key")

    device.last_seen_at = datetime.now(timezone.utc)
    if payload.fw_version:
        device.fw_version = payload.fw_version

    db.commit()

    await request.app.state.ws_hub.send_event(
        "device_status",
        {
            "device_id": str(device.id),
            "name": device.name,
            "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
            "fw_version": device.fw_version,
            "status": "online",
        },
    )

    return DeviceHeartbeatOut(status="ok", device_id=device.id, last_seen_at=device.last_seen_at)


@router.get("", response_model=list[DeviceRegisterOut])
def list_devices(db: Session = Depends(get_db)) -> list[DeviceRegisterOut]:
    devices = db.scalars(select(Device).order_by(Device.created_at.desc()).limit(200)).all()
    return [DeviceRegisterOut.model_validate(item) for item in devices]


@router.get("/config/{device_id}", response_model=DeviceConfigOut)
def device_config(device_id: UUID, db: Session = Depends(get_db)) -> DeviceConfigOut:
    # REST-oriented alias for /api/v1/device-config/{device_id}.
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    return DeviceConfigOut(
        device_id=device.id,
        fps=settings.default_stream_fps,
        quality=settings.default_jpeg_quality,
        resolution=settings.default_resolution,
        max_frame_bytes=settings.frame_max_bytes,
    )


@router.get("/key/{device_key}", response_model=DeviceRegisterOut)
def get_device_by_key(device_key: str, db: Session = Depends(get_db)) -> DeviceRegisterOut:
    device = db.scalar(select(Device).where(Device.device_key == device_key))
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return DeviceRegisterOut.model_validate(device)


def _generate_device_key() -> str:
    # 43-char url-safe key, enough for header/query use.
    return secrets.token_urlsafe(32)

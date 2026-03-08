from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.entities import Device, FrameEvent, Session as SessionModel
from app.schemas.devices import DeviceConfigOut
from app.schemas.frames import FrameAcceptedOut
from app.services.device_auth import get_device_by_key, resolve_device_key
from app.services.frame_queue import FrameJob
from app.services.frame_rate import DeviceFpsLimiter

router = APIRouter(tags=["frames"])
settings = get_settings()
fps_limiter = DeviceFpsLimiter(max_fps=settings.frame_max_fps)


@router.post("/frames", response_model=FrameAcceptedOut, status_code=202)
async def ingest_frame(
    request: Request,
    file: UploadFile = File(...),
    session_id: UUID = Form(...),
    ts: str | None = Form(default=None),
    device_key: str | None = Form(default=None),
    x_device_key: str | None = Header(default=None, alias="X-Device-Key"),
    device_key_query: str | None = Query(default=None, alias="device_key"),
    db: Session = Depends(get_db),
) -> FrameAcceptedOut:
    resolved_key = resolve_device_key(device_key, x_device_key, device_key_query)
    device = get_device_by_key(db, resolved_key)

    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.device_id != device.id:
        raise HTTPException(status_code=403, detail="Session does not belong to this device")

    frame_ts = _parse_ts(ts)

    frame_bytes = await file.read()
    if not frame_bytes:
        raise HTTPException(status_code=400, detail="Empty frame payload")

    if len(frame_bytes) > settings.frame_max_bytes:
        raise HTTPException(status_code=413, detail=f"Frame too large ({len(frame_bytes)} bytes)")

    frame_event = FrameEvent(
        session_id=session.id,
        device_id=device.id,
        ts=frame_ts,
        frame_ref=None,
        processing_status="queued",
    )
    db.add(frame_event)
    db.commit()
    db.refresh(frame_event)

    if not fps_limiter.allow(device.device_key, frame_ts):
        frame_event.processing_status = "throttled"
        db.commit()
        await request.app.state.ws_hub.send_event(
            "frame_processed",
            {
                "frame_event_id": str(frame_event.id),
                "session_id": str(session.id),
                "status": "throttled",
                "latency_ms": None,
            },
            session_id=session.id,
        )

        return FrameAcceptedOut(
            status="accepted",
            frame_event_id=frame_event.id,
            processing_status="throttled",
        )

    processing_status = await request.app.state.frame_queue.submit(
        FrameJob(frame_event_id=frame_event.id, frame_bytes=frame_bytes)
    )

    if processing_status == "done":
        db.refresh(frame_event)

    return FrameAcceptedOut(
        status="accepted",
        frame_event_id=frame_event.id,
        processing_status=processing_status,
    )


@router.get("/device-config/{device_id}", response_model=DeviceConfigOut)
def get_device_config(device_id: UUID, db: Session = Depends(get_db)) -> DeviceConfigOut:
    # Compatibility path used by firmware: /api/v1/device-config/{device_id}
    # Alias also exists at /api/v1/devices/config/{device_id}.
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


def _parse_ts(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw.replace("Z", "+00:00")

    try:
        dt = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid timestamp format") from exc

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

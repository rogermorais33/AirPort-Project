from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Command, FaceMetric, FrameEvent, GazePoint, Session as SessionModel
from app.schemas.reports import CommandOut, HeatmapOut, SessionReportOut, TimelineBucket, TimelineOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/session/{session_id}", response_model=SessionReportOut)
def session_summary(session_id: UUID, db: Session = Depends(get_db)) -> SessionReportOut:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    frames_total = int(
        db.scalar(select(func.count()).select_from(FrameEvent).where(FrameEvent.session_id == session.id)) or 0
    )
    frames_done = int(
        db.scalar(
            select(func.count())
            .select_from(FrameEvent)
            .where(FrameEvent.session_id == session.id, FrameEvent.processing_status == "done")
        )
        or 0
    )
    frames_error = int(
        db.scalar(
            select(func.count())
            .select_from(FrameEvent)
            .where(FrameEvent.session_id == session.id, FrameEvent.processing_status == "error")
        )
        or 0
    )
    commands_total = int(
        db.scalar(select(func.count()).select_from(Command).where(Command.session_id == session.id)) or 0
    )

    avg_latency_ms = db.scalar(
        select(func.avg(FrameEvent.latency_ms)).where(
            FrameEvent.session_id == session.id,
            FrameEvent.processing_status == "done",
            FrameEvent.latency_ms.is_not(None),
        )
    )

    face_detected = int(
        db.scalar(
            select(func.count())
            .select_from(FaceMetric)
            .join(FrameEvent, FaceMetric.frame_event_id == FrameEvent.id)
            .where(FrameEvent.session_id == session.id, FaceMetric.face_detected.is_(True))
        )
        or 0
    )

    duration_s = 0.0
    started_at = _as_utc(session.started_at)
    ended_at = _as_utc(session.ended_at) if session.ended_at is not None else None

    if ended_at is not None:
        duration_s = max(0.0, (ended_at - started_at).total_seconds())
    else:
        duration_s = max(0.0, (datetime.now(timezone.utc) - started_at).total_seconds())

    face_detection_rate = round(face_detected / max(frames_total, 1), 4)

    return SessionReportOut(
        session_id=session.id,
        device_id=session.device_id,
        mode=session.mode,
        started_at=started_at,
        ended_at=ended_at,
        duration_s=duration_s,
        frames_total=frames_total,
        frames_done=frames_done,
        frames_error=frames_error,
        commands_total=commands_total,
        avg_latency_ms=float(avg_latency_ms) if avg_latency_ms is not None else None,
        face_detection_rate=face_detection_rate,
    )


@router.get("/session/{session_id}/heatmap", response_model=HeatmapOut)
def heatmap(
    session_id: UUID,
    grid_w: int = Query(default=20, ge=4, le=80),
    grid_h: int = Query(default=12, ge=4, le=60),
    db: Session = Depends(get_db),
) -> HeatmapOut:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    rows = db.execute(
        select(GazePoint)
        .join(FrameEvent, GazePoint.frame_event_id == FrameEvent.id)
        .where(FrameEvent.session_id == session.id)
        .order_by(GazePoint.ts)
    ).scalars()

    bins = [[0 for _ in range(grid_w)] for _ in range(grid_h)]
    total = 0

    for point in rows:
        x_norm, y_norm = _normalize_point(session, point.x, point.y)
        ix = min(grid_w - 1, max(0, int(x_norm * grid_w)))
        iy = min(grid_h - 1, max(0, int(y_norm * grid_h)))
        bins[iy][ix] += 1
        total += 1

    max_bin = max((max(row) for row in bins), default=0)

    return HeatmapOut(
        session_id=session.id,
        bins=bins,
        grid_w=grid_w,
        grid_h=grid_h,
        total_points=total,
        max_bin=max_bin,
    )


@router.get("/session/{session_id}/timeline", response_model=TimelineOut)
def timeline(session_id: UUID, db: Session = Depends(get_db)) -> TimelineOut:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    frame_rows = db.scalars(select(FrameEvent.ts).where(FrameEvent.session_id == session.id)).all()
    command_rows = db.scalars(select(Command.ts).where(Command.session_id == session.id)).all()

    buckets: dict[datetime, dict[str, int]] = defaultdict(lambda: {"frames": 0, "commands": 0})

    for ts in frame_rows:
        key = _as_utc(ts).replace(microsecond=0)
        buckets[key]["frames"] += 1

    for ts in command_rows:
        key = _as_utc(ts).replace(microsecond=0)
        buckets[key]["commands"] += 1

    items = [
        TimelineBucket(ts=ts, frames=counts["frames"], commands=counts["commands"])
        for ts, counts in sorted(buckets.items())
    ]

    return TimelineOut(session_id=session.id, items=items)


@router.get("/session/{session_id}/commands", response_model=list[CommandOut])
def commands(session_id: UUID, db: Session = Depends(get_db)) -> list[CommandOut]:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    rows = db.scalars(
        select(Command)
        .where(Command.session_id == session.id)
        .order_by(Command.ts.desc())
        .limit(500)
    ).all()

    return [CommandOut.model_validate(item) for item in rows]


def _normalize_point(session: SessionModel, x: float, y: float) -> tuple[float, float]:
    if session.screen_w and session.screen_h and session.screen_w > 0 and session.screen_h > 0:
        return min(max(x / session.screen_w, 0.0), 1.0), min(max(y / session.screen_h, 0.0), 1.0)
    return min(max(x, 0.0), 1.0), min(max(y, 0.0), 1.0)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

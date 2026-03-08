from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Device, Page, Session as SessionModel
from app.schemas.sessions import (
    PageStartIn,
    PageStartOut,
    SessionEndOut,
    SessionOut,
    SessionStartIn,
    SessionStartOut,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/start", response_model=SessionStartOut, status_code=201)
def start_session(payload: SessionStartIn, db: Session = Depends(get_db)) -> SessionStartOut:
    device = db.get(Device, payload.device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    now = datetime.now(timezone.utc)
    # Keep one active session per device to prevent dashboard/firmware desynchronization.
    active_sessions = db.scalars(
        select(SessionModel).where(SessionModel.device_id == device.id, SessionModel.active.is_(True))
    ).all()
    for active_session in active_sessions:
        active_session.active = False
        active_session.ended_at = now
        _close_active_page(db, active_session.id, now)

    session = SessionModel(
        device_id=device.id,
        screen_w=payload.screen_w,
        screen_h=payload.screen_h,
        mode=payload.mode,
        active=True,
        started_at=now,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return SessionStartOut(session=SessionOut.model_validate(session))


@router.post("/{session_id}/end", response_model=SessionEndOut)
def end_session(session_id: UUID, db: Session = Depends(get_db)) -> SessionEndOut:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    session.active = False
    session.ended_at = datetime.now(timezone.utc)

    _close_active_page(db, session.id, session.ended_at)

    db.commit()

    return SessionEndOut(session_id=session.id, active=session.active, ended_at=session.ended_at)


@router.post("/{session_id}/page", response_model=PageStartOut, status_code=201)
def start_page(
    session_id: UUID,
    payload: PageStartIn,
    db: Session = Depends(get_db),
) -> PageStartOut:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)

    previous_page = db.scalar(
        select(Page)
        .where(Page.session_id == session.id, Page.ended_at.is_(None))
        .order_by(desc(Page.started_at))
        .limit(1)
    )
    if previous_page is not None:
        previous_page.ended_at = now

    page = Page(
        session_id=session.id,
        url=payload.url,
        title=payload.title,
        started_at=now,
    )
    db.add(page)
    db.commit()
    db.refresh(page)

    return PageStartOut.model_validate(page)


@router.get("", response_model=list[SessionOut])
def list_sessions(
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[SessionOut]:
    sessions = db.scalars(select(SessionModel).order_by(SessionModel.started_at.desc()).limit(limit)).all()
    return [SessionOut.model_validate(item) for item in sessions]


@router.get("/active", response_model=SessionOut)
def get_active_session(
    device_id: UUID = Query(...),
    db: Session = Depends(get_db),
) -> SessionOut:
    # Used by firmware/dashboard pairing flow ("Attach Active").
    session = db.scalar(
        select(SessionModel)
        .where(SessionModel.device_id == device_id, SessionModel.active.is_(True))
        .order_by(desc(SessionModel.started_at))
        .limit(1)
    )
    if session is None:
        raise HTTPException(status_code=404, detail="No active session for this device")

    return SessionOut.model_validate(session)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: UUID, db: Session = Depends(get_db)) -> SessionOut:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionOut.model_validate(session)


@router.get("/{session_id}/pages", response_model=list[PageStartOut])
def list_pages(session_id: UUID, db: Session = Depends(get_db)) -> list[PageStartOut]:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    pages = db.scalars(
        select(Page)
        .where(Page.session_id == session.id)
        .order_by(Page.started_at.desc())
        .limit(500)
    ).all()
    return [PageStartOut.model_validate(page) for page in pages]


@router.get("/{session_id}/preview")
def get_session_preview(
    session_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    session = db.get(SessionModel, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    preview_store = getattr(request.app.state, "frame_preview", None)
    if preview_store is None or not hasattr(preview_store, "get"):
        raise HTTPException(status_code=503, detail="Preview service unavailable")

    frame = preview_store.get(session.id)
    if frame is None:
        raise HTTPException(status_code=404, detail="No preview frame for this session yet")

    return Response(
        content=frame.image_bytes,
        media_type=frame.content_type or "image/jpeg",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "X-Frame-Timestamp": frame.ts.isoformat(),
            "X-Frame-Size": str(frame.size_bytes),
        },
    )


def _close_active_page(db: Session, session_id: UUID, ended_at: datetime) -> None:
    active_page = db.scalar(
        select(Page)
        .where(Page.session_id == session_id, Page.ended_at.is_(None))
        .order_by(desc(Page.started_at))
        .limit(1)
    )
    if active_page is not None:
        active_page.ended_at = ended_at

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, desc, select

from app.db.session import SessionLocal
from app.models.entities import (
    Anomaly,
    CalibrationProfile,
    Command,
    FaceMetric,
    FrameEvent,
    GazePoint,
    Page,
    Session,
)
from app.services.commands_engine import commands_engine
from app.services.cv_pipeline import CVPipeline
from app.services.gaze_mapper import predict_gaze
from app.services.ws_hub import LiveWebSocketHub

logger = logging.getLogger(__name__)


class FramePipelineService:
    def __init__(self, ws_hub: LiveWebSocketHub) -> None:
        self._cv = CVPipeline()
        self._ws_hub = ws_hub

    def process_frame_event(self, frame_event_id: UUID, frame_bytes: bytes) -> None:
        started = time.perf_counter()
        db = SessionLocal()

        try:
            frame_event = db.get(FrameEvent, frame_event_id)
            if frame_event is None:
                return

            frame_event.processing_status = "processing"
            db.commit()

            session = db.get(Session, frame_event.session_id)
            if session is None:
                raise RuntimeError("Session not found")

            cv_result = self._cv.process_jpeg(frame_bytes)

            face_metric = FaceMetric(
                frame_event_id=frame_event.id,
                face_detected=cv_result.face_detected,
                confidence=cv_result.confidence,
                yaw=cv_result.yaw,
                pitch=cv_result.pitch,
                roll=cv_result.roll,
                eye_left_json=cv_result.eye_left,
                eye_right_json=cv_result.eye_right,
                blink=cv_result.blink,
            )
            db.add(face_metric)

            latest_profile = db.scalar(
                select(CalibrationProfile)
                .where(CalibrationProfile.device_id == session.device_id)
                .order_by(desc(CalibrationProfile.created_at))
                .limit(1)
            )

            active_page = db.scalar(_active_page_stmt(session.id))

            gaze_payload: dict[str, object] | None = None
            if cv_result.face_detected:
                gaze_x, gaze_y, gaze_conf, gaze_source = predict_gaze(
                    cv_result.features,
                    raw_guess_norm=cv_result.raw_gaze_norm,
                    profile_params=latest_profile.params_json if latest_profile else None,
                    screen_w=session.screen_w,
                    screen_h=session.screen_h,
                )
                gaze_point = GazePoint(
                    page_id=active_page.id if active_page else None,
                    frame_event_id=frame_event.id,
                    ts=frame_event.ts,
                    x=gaze_x,
                    y=gaze_y,
                    confidence=gaze_conf,
                    source=gaze_source,
                )
                db.add(gaze_point)

                gaze_payload = {
                    "session_id": str(session.id),
                    "frame_event_id": str(frame_event.id),
                    "x": gaze_x,
                    "y": gaze_y,
                    "confidence": gaze_conf,
                    "source": gaze_source,
                    "page_id": str(active_page.id) if active_page else None,
                }

            command_payloads: list[dict[str, object]] = []
            if cv_result.face_detected:
                decisions = commands_engine.evaluate(
                    session_id=session.id,
                    ts=frame_event.ts,
                    yaw=cv_result.yaw,
                    pitch=cv_result.pitch,
                )
                for decision in decisions:
                    command = Command(
                        session_id=session.id,
                        ts=frame_event.ts,
                        command=decision.command,
                        trigger=decision.trigger,
                        confidence=decision.confidence,
                        cooldown_ms=decision.cooldown_ms,
                        meta_json={
                            "yaw": round(cv_result.yaw, 3),
                            "pitch": round(cv_result.pitch, 3),
                            "roll": round(cv_result.roll, 3),
                        },
                    )
                    db.add(command)
                    command_payloads.append(
                        {
                            "session_id": str(session.id),
                            "command": decision.command,
                            "trigger": decision.trigger,
                            "confidence": decision.confidence,
                            "cooldown_ms": decision.cooldown_ms,
                        }
                    )

            frame_event.processing_status = "done"
            frame_event.latency_ms = round((time.perf_counter() - started) * 1000.0, 2)
            db.commit()

            frame_processed_payload = {
                "frame_event_id": str(frame_event.id),
                "session_id": str(session.id),
                "status": frame_event.processing_status,
                "latency_ms": frame_event.latency_ms,
                "face_detected": cv_result.face_detected,
            }

            face_payload = {
                "frame_event_id": str(frame_event.id),
                "session_id": str(session.id),
                "face_detected": cv_result.face_detected,
                "confidence": cv_result.confidence,
                "yaw": cv_result.yaw,
                "pitch": cv_result.pitch,
                "roll": cv_result.roll,
                "blink": cv_result.blink,
                "features": cv_result.features,
                "backend": cv_result.backend,
            }

            asyncio.run(self._emit_success_events(session.id, frame_processed_payload, face_payload, gaze_payload, command_payloads))
        except Exception as exc:  # pragma: no cover - defensive runtime branch
            logger.exception("frame processing failed event_id=%s", frame_event_id)
            self._mark_failed(db, frame_event_id, str(exc))
        finally:
            db.close()

    async def _emit_success_events(
        self,
        session_id: UUID,
        frame_payload: dict[str, object],
        face_payload: dict[str, object],
        gaze_payload: dict[str, object] | None,
        command_payloads: list[dict[str, object]],
    ) -> None:
        await self._ws_hub.send_event("frame_processed", frame_payload, session_id=session_id)
        await self._ws_hub.send_event("face_metrics", face_payload, session_id=session_id)

        if gaze_payload:
            await self._ws_hub.send_event("gaze_point", gaze_payload, session_id=session_id)

        for payload in command_payloads:
            await self._ws_hub.send_event("command_triggered", payload, session_id=session_id)

    def _mark_failed(self, db, frame_event_id: UUID, detail: str) -> None:
        frame_event = db.get(FrameEvent, frame_event_id)
        if frame_event is None:
            return

        frame_event.processing_status = "error"
        frame_event.latency_ms = None

        anomaly = Anomaly(
            session_id=frame_event.session_id,
            ts=frame_event.ts,
            kind="frame_processing_error",
            severity="warning",
            description=detail[:1000],
            meta_json={"frame_event_id": str(frame_event.id)},
        )
        db.add(anomaly)
        db.commit()

        asyncio.run(
            self._ws_hub.send_event(
                "frame_processed",
                {
                    "frame_event_id": str(frame_event.id),
                    "session_id": str(frame_event.session_id),
                    "status": "error",
                    "detail": detail,
                },
                session_id=frame_event.session_id,
            )
        )

    def cv_diagnostics(self) -> dict[str, object]:
        return self._cv.diagnostics()


def latest_features_for_session(session_id: UUID) -> dict[str, float] | None:
    db = SessionLocal()
    try:
        row = db.execute(
            select(FaceMetric, FrameEvent)
            .join(FrameEvent, FaceMetric.frame_event_id == FrameEvent.id)
            .where(FrameEvent.session_id == session_id)
            .order_by(desc(FrameEvent.ts))
            .limit(1)
        ).first()

        if row is None:
            return None

        metric, frame_event = row
        return {
            "face_x_norm": float((metric.eye_left_json or {}).get("x", 0.5) + (metric.eye_right_json or {}).get("x", 0.5)) / 2.0,
            "face_y_norm": float((metric.eye_left_json or {}).get("y", 0.5) + (metric.eye_right_json or {}).get("y", 0.5)) / 2.0,
            "yaw": float(metric.yaw or 0.0),
            "pitch": float(metric.pitch or 0.0),
            "roll": float(metric.roll or 0.0),
            "timestamp": frame_event.ts.timestamp(),
        }
    finally:
        db.close()


def _active_page_stmt(session_id: UUID) -> Select[tuple[Page]]:
    return (
        select(Page)
        .where(Page.session_id == session_id, Page.ended_at.is_(None))
        .order_by(desc(Page.started_at))
        .limit(1)
    )

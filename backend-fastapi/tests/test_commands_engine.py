from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4


def test_eye_gaze_triggers_next_when_iris_signal_is_stable():
    from app.services.commands_engine import CommandsEngine

    engine = CommandsEngine()
    session_id = uuid4()
    started_at = datetime.now(timezone.utc)

    first = engine.evaluate(
        session_id,
        started_at,
        yaw=0.0,
        pitch=0.0,
        gaze_x_norm=0.50,
        gaze_y_norm=0.50,
        eye_tracking_available=True,
    )
    assert first == []

    result = []
    for offset_ms in (150, 300, 450, 600, 750):
        result = engine.evaluate(
            session_id,
            started_at + timedelta(milliseconds=offset_ms),
            yaw=0.0,
            pitch=0.0,
            gaze_x_norm=0.74,
            gaze_y_norm=0.50,
            eye_tracking_available=True,
        )

    assert len(result) == 1
    assert result[0].command == "NEXT"
    assert result[0].source == "eye_gaze"


def test_head_pose_still_works_without_iris_signal():
    from app.services.commands_engine import CommandsEngine

    engine = CommandsEngine()
    session_id = uuid4()
    started_at = datetime.now(timezone.utc)

    result = []
    for offset_ms, yaw in ((0, 0.0), (100, -28.0), (250, -30.0), (400, -30.0), (550, -30.0), (700, -30.0), (850, -30.0)):
        result = engine.evaluate(
            session_id,
            started_at + timedelta(milliseconds=offset_ms),
            yaw=yaw,
            pitch=0.0,
            eye_tracking_available=False,
        )

    assert len(result) == 1
    assert result[0].command == "PREV"
    assert result[0].source == "head_pose"

from datetime import datetime
from uuid import UUID

from app.schemas.common import SchemaBase


class SessionReportOut(SchemaBase):
    session_id: UUID
    device_id: UUID
    mode: str
    started_at: datetime
    ended_at: datetime | None
    duration_s: float
    frames_total: int
    frames_done: int
    frames_error: int
    commands_total: int
    avg_latency_ms: float | None
    face_detection_rate: float


class HeatmapOut(SchemaBase):
    session_id: UUID
    bins: list[list[int]]
    grid_w: int
    grid_h: int
    total_points: int
    max_bin: int


class TimelineBucket(SchemaBase):
    ts: datetime
    frames: int
    commands: int


class TimelineOut(SchemaBase):
    session_id: UUID
    items: list[TimelineBucket]


class CommandOut(SchemaBase):
    id: UUID
    session_id: UUID
    ts: datetime
    command: str
    trigger: str
    confidence: float
    cooldown_ms: int
    meta_json: dict[str, float | int | str | bool]

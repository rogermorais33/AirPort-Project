from datetime import datetime

from pydantic import Field

from app.schemas.common import SchemaBase, utc_now


class HealthOut(SchemaBase):
    api: str
    database: str
    queue_mode: str
    redis_enabled: bool
    cv_backend_requested: str
    cv_backend_active: str
    mediapipe_available: bool
    mediapipe_model: str | None
    mediapipe_error: str | None
    timestamp: datetime = Field(default_factory=utc_now)

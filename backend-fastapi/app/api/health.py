from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.schemas.health import HealthOut

settings = get_settings()


def health_status(db: Session, cv_status: dict[str, object] | None = None) -> HealthOut:
    database = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        database = "unavailable"

    diagnostics = cv_status or {}

    return HealthOut(
        api="ok",
        database=database,
        queue_mode=settings.frame_queue_mode,
        redis_enabled=settings.redis_enabled,
        cv_backend_requested=str(diagnostics.get("cv_backend_requested", "auto")),
        cv_backend_active=str(diagnostics.get("cv_backend_active", "none")),
        mediapipe_available=bool(diagnostics.get("mediapipe_available", False)),
        mediapipe_model=(
            str(diagnostics["mediapipe_model"])
            if diagnostics.get("mediapipe_model") is not None
            else None
        ),
        mediapipe_error=(
            str(diagnostics["mediapipe_error"])
            if diagnostics.get("mediapipe_error") is not None
            else None
        ),
    )

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GazePilot API"
    app_env: str = "dev"
    app_port: int = 8000
    app_host: str = "0.0.0.0"
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://gazepilot:gazepilot@localhost:5432/gazepilot"
    ws_max_clients: int = 200

    frame_queue_mode: str = "memory"  # sync | memory | redis
    frame_queue_maxsize: int = 256
    frame_max_fps: float = 8.0
    frame_max_bytes: int = 350_000

    redis_url: str = "redis://localhost:6379/0"
    redis_enabled: bool = False
    redis_queue_name: str = "gazepilot:frames"

    command_ema_alpha: float = Field(default=0.35, ge=0.01, le=1.0)
    command_dwell_ms: int = Field(default=400, ge=100, le=5000)
    command_cooldown_ms: int = Field(default=1000, ge=200, le=10_000)

    yaw_threshold_deg: float = 20.0
    pitch_threshold_deg: float = 15.0

    default_stream_fps: int = 6
    default_jpeg_quality: int = 10
    default_resolution: str = "QVGA"

    cv_backend: str = "auto"  # auto | mediapipe | opencv
    cv_mediapipe_model_path: str = "models/face_landmarker.task"
    cv_min_face_detection_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    cv_min_face_presence_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    cv_min_tracking_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    cv_blink_ear_threshold: float = Field(default=0.19, ge=0.05, le=0.5)

    auto_create_tables: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

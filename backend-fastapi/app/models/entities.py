from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    device_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fw_version: Mapped[str | None] = mapped_column(String(48), nullable=True)

    sessions: Mapped[list[Session]] = relationship(back_populates="device")
    profiles: Mapped[list[CalibrationProfile]] = relationship(back_populates="device")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("devices.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    screen_w: Mapped[int | None] = mapped_column(Integer, nullable=True)
    screen_h: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mode: Mapped[str] = mapped_column(String(32), default="mvp")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    device: Mapped[Device] = relationship(back_populates="sessions")
    pages: Mapped[list[Page]] = relationship(back_populates="session")
    frame_events: Mapped[list[FrameEvent]] = relationship(back_populates="session")
    commands: Mapped[list[Command]] = relationship(back_populates="session")


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sessions.id"), index=True)
    url: Mapped[str] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped[Session] = relationship(back_populates="pages")
    gaze_points: Mapped[list[GazePoint]] = relationship(back_populates="page")


class CalibrationProfile(Base):
    __tablename__ = "calibration_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("devices.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    model_type: Mapped[str] = mapped_column(String(64), default="linear_regression")
    params_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    points_count: Mapped[int] = mapped_column(Integer, default=0)

    device: Mapped[Device] = relationship(back_populates="profiles")
    points: Mapped[list[CalibrationPoint]] = relationship(back_populates="profile")


class CalibrationPoint(Base):
    __tablename__ = "calibration_points"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("calibration_profiles.id"), index=True)
    target_x: Mapped[float] = mapped_column(Float)
    target_y: Mapped[float] = mapped_column(Float)
    features_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    profile: Mapped[CalibrationProfile] = relationship(back_populates="points")


class FrameEvent(Base):
    __tablename__ = "frame_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sessions.id"), index=True)
    device_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("devices.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    frame_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    session: Mapped[Session] = relationship(back_populates="frame_events")
    face_metric: Mapped[FaceMetric | None] = relationship(back_populates="frame_event")
    gaze_points: Mapped[list[GazePoint]] = relationship(back_populates="frame_event")


class FaceMetric(Base):
    __tablename__ = "face_metrics"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    frame_event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("frame_events.id"),
        unique=True,
        index=True,
    )
    face_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    yaw: Mapped[float | None] = mapped_column(Float, nullable=True)
    pitch: Mapped[float | None] = mapped_column(Float, nullable=True)
    roll: Mapped[float | None] = mapped_column(Float, nullable=True)
    eye_left_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    eye_right_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    blink: Mapped[bool] = mapped_column(Boolean, default=False)

    frame_event: Mapped[FrameEvent] = relationship(back_populates="face_metric")


class GazePoint(Base):
    __tablename__ = "gaze_points"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    page_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("pages.id"), nullable=True, index=True)
    frame_event_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("frame_events.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(64), default="headpose")

    page: Mapped[Page | None] = relationship(back_populates="gaze_points")
    frame_event: Mapped[FrameEvent] = relationship(back_populates="gaze_points")


class Command(Base):
    __tablename__ = "commands"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sessions.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    command: Mapped[str] = mapped_column(String(32), index=True)
    trigger: Mapped[str] = mapped_column(String(128))
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    cooldown_ms: Mapped[int] = mapped_column(Integer, default=1000)
    meta_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    session: Mapped[Session] = relationship(back_populates="commands")


class Anomaly(Base):
    __tablename__ = "anomalies"
    __table_args__ = (UniqueConstraint("session_id", "ts", "kind", name="uq_anomaly_session_ts_kind"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sessions.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    kind: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(16), default="info")
    description: Mapped[str] = mapped_column(Text)
    meta_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

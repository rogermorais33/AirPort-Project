"""initial gazepilot schema

Revision ID: 20260308_0001
Revises: 
Create Date: 2026-03-08 00:00:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260308_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("device_key", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fw_version", sa.String(length=48), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_key"),
    )
    op.create_index(op.f("ix_devices_device_key"), "devices", ["device_key"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("screen_w", sa.Integer(), nullable=True),
        sa.Column("screen_h", sa.Integer(), nullable=True),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sessions_device_id"), "sessions", ["device_id"], unique=False)
    op.create_index(op.f("ix_sessions_started_at"), "sessions", ["started_at"], unique=False)
    op.create_index(op.f("ix_sessions_active"), "sessions", ["active"], unique=False)

    op.create_table(
        "pages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pages_session_id"), "pages", ["session_id"], unique=False)

    op.create_table(
        "calibration_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("model_type", sa.String(length=64), nullable=False),
        sa.Column("params_json", sa.JSON(), nullable=False),
        sa.Column("points_count", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_calibration_profiles_device_id"), "calibration_profiles", ["device_id"], unique=False
    )

    op.create_table(
        "calibration_points",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("target_x", sa.Float(), nullable=False),
        sa.Column("target_y", sa.Float(), nullable=False),
        sa.Column("features_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["calibration_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_calibration_points_profile_id"), "calibration_points", ["profile_id"], unique=False
    )

    op.create_table(
        "frame_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("frame_ref", sa.Text(), nullable=True),
        sa.Column("processing_status", sa.String(length=32), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_frame_events_device_id"), "frame_events", ["device_id"], unique=False)
    op.create_index(op.f("ix_frame_events_session_id"), "frame_events", ["session_id"], unique=False)
    op.create_index(op.f("ix_frame_events_ts"), "frame_events", ["ts"], unique=False)
    op.create_index(
        op.f("ix_frame_events_processing_status"), "frame_events", ["processing_status"], unique=False
    )

    op.create_table(
        "face_metrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("frame_event_id", sa.Uuid(), nullable=False),
        sa.Column("face_detected", sa.Boolean(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("yaw", sa.Float(), nullable=True),
        sa.Column("pitch", sa.Float(), nullable=True),
        sa.Column("roll", sa.Float(), nullable=True),
        sa.Column("eye_left_json", sa.JSON(), nullable=True),
        sa.Column("eye_right_json", sa.JSON(), nullable=True),
        sa.Column("blink", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["frame_event_id"], ["frame_events.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("frame_event_id"),
    )
    op.create_index(op.f("ix_face_metrics_frame_event_id"), "face_metrics", ["frame_event_id"], unique=True)

    op.create_table(
        "gaze_points",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("page_id", sa.Uuid(), nullable=True),
        sa.Column("frame_event_id", sa.Uuid(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["frame_event_id"], ["frame_events.id"]),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gaze_points_frame_event_id"), "gaze_points", ["frame_event_id"], unique=False)
    op.create_index(op.f("ix_gaze_points_page_id"), "gaze_points", ["page_id"], unique=False)
    op.create_index(op.f("ix_gaze_points_ts"), "gaze_points", ["ts"], unique=False)

    op.create_table(
        "commands",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("command", sa.String(length=32), nullable=False),
        sa.Column("trigger", sa.String(length=128), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("cooldown_ms", sa.Integer(), nullable=False),
        sa.Column("meta_json", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_commands_command"), "commands", ["command"], unique=False)
    op.create_index(op.f("ix_commands_session_id"), "commands", ["session_id"], unique=False)
    op.create_index(op.f("ix_commands_ts"), "commands", ["ts"], unique=False)

    op.create_table(
        "anomalies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("meta_json", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "ts", "kind", name="uq_anomaly_session_ts_kind"),
    )
    op.create_index(op.f("ix_anomalies_session_id"), "anomalies", ["session_id"], unique=False)
    op.create_index(op.f("ix_anomalies_ts"), "anomalies", ["ts"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_anomalies_ts"), table_name="anomalies")
    op.drop_index(op.f("ix_anomalies_session_id"), table_name="anomalies")
    op.drop_table("anomalies")

    op.drop_index(op.f("ix_commands_ts"), table_name="commands")
    op.drop_index(op.f("ix_commands_session_id"), table_name="commands")
    op.drop_index(op.f("ix_commands_command"), table_name="commands")
    op.drop_table("commands")

    op.drop_index(op.f("ix_gaze_points_ts"), table_name="gaze_points")
    op.drop_index(op.f("ix_gaze_points_page_id"), table_name="gaze_points")
    op.drop_index(op.f("ix_gaze_points_frame_event_id"), table_name="gaze_points")
    op.drop_table("gaze_points")

    op.drop_index(op.f("ix_face_metrics_frame_event_id"), table_name="face_metrics")
    op.drop_table("face_metrics")

    op.drop_index(op.f("ix_frame_events_processing_status"), table_name="frame_events")
    op.drop_index(op.f("ix_frame_events_ts"), table_name="frame_events")
    op.drop_index(op.f("ix_frame_events_session_id"), table_name="frame_events")
    op.drop_index(op.f("ix_frame_events_device_id"), table_name="frame_events")
    op.drop_table("frame_events")

    op.drop_index(op.f("ix_calibration_points_profile_id"), table_name="calibration_points")
    op.drop_table("calibration_points")

    op.drop_index(op.f("ix_calibration_profiles_device_id"), table_name="calibration_profiles")
    op.drop_table("calibration_profiles")

    op.drop_index(op.f("ix_pages_session_id"), table_name="pages")
    op.drop_table("pages")

    op.drop_index(op.f("ix_sessions_active"), table_name="sessions")
    op.drop_index(op.f("ix_sessions_started_at"), table_name="sessions")
    op.drop_index(op.f("ix_sessions_device_id"), table_name="sessions")
    op.drop_table("sessions")

    op.drop_index(op.f("ix_devices_device_key"), table_name="devices")
    op.drop_table("devices")

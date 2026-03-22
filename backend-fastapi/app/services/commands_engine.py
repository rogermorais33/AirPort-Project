from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import NamedTuple
from uuid import UUID

from app.core.config import get_settings

settings = get_settings()


class CommandDecision(NamedTuple):
    command: str
    trigger: str
    confidence: float
    cooldown_ms: int
    source: str


@dataclass
class SessionCommandState:
    ema_yaw: float = 0.0
    ema_pitch: float = 0.0
    ema_gaze_x: float = 0.5
    ema_gaze_y: float = 0.5
    neutral_yaw: float = 0.0
    neutral_pitch: float = 0.0
    neutral_gaze_x: float = 0.5
    neutral_gaze_y: float = 0.5
    initialized: bool = False
    neutral_initialized: bool = False
    gaze_initialized: bool = False
    candidate_since: dict[str, datetime] = field(default_factory=dict)
    last_trigger_at: datetime = field(default_factory=lambda: datetime.fromtimestamp(0, tz=timezone.utc))


class CommandsEngine:
    def __init__(self) -> None:
        self._states: dict[UUID, SessionCommandState] = {}
        self._alpha = settings.command_ema_alpha
        self._dwell_ms = settings.command_dwell_ms
        self._cooldown_ms = settings.command_cooldown_ms
        self._yaw = settings.yaw_threshold_deg
        self._pitch = settings.pitch_threshold_deg
        self._gaze_horizontal = settings.gaze_horizontal_threshold_norm
        self._gaze_vertical = settings.gaze_vertical_threshold_norm
        self._gaze_alpha = 0.45
        self._neutral_alpha = 0.02

    def evaluate(
        self,
        session_id: UUID,
        ts: datetime,
        yaw: float,
        pitch: float,
        *,
        gaze_x_norm: float | None = None,
        gaze_y_norm: float | None = None,
        eye_tracking_available: bool = False,
    ) -> list[CommandDecision]:
        state = self._states.setdefault(session_id, SessionCommandState())

        if not state.initialized:
            state.ema_yaw = yaw
            state.ema_pitch = pitch
            state.initialized = True
        else:
            state.ema_yaw = self._alpha * yaw + (1.0 - self._alpha) * state.ema_yaw
            state.ema_pitch = self._alpha * pitch + (1.0 - self._alpha) * state.ema_pitch

        if gaze_x_norm is not None and gaze_y_norm is not None:
            if not state.gaze_initialized:
                state.ema_gaze_x = gaze_x_norm
                state.ema_gaze_y = gaze_y_norm
                state.neutral_gaze_x = gaze_x_norm
                state.neutral_gaze_y = gaze_y_norm
                state.gaze_initialized = True
            else:
                state.ema_gaze_x = self._gaze_alpha * gaze_x_norm + (1.0 - self._gaze_alpha) * state.ema_gaze_x
                state.ema_gaze_y = self._gaze_alpha * gaze_y_norm + (1.0 - self._gaze_alpha) * state.ema_gaze_y

        if not state.neutral_initialized:
            state.neutral_yaw = state.ema_yaw
            state.neutral_pitch = state.ema_pitch
            state.neutral_initialized = True

        delta_yaw = state.ema_yaw - state.neutral_yaw
        delta_pitch = state.ema_pitch - state.neutral_pitch
        delta_gaze_x = state.ema_gaze_x - state.neutral_gaze_x if state.gaze_initialized else 0.0
        delta_gaze_y = state.ema_gaze_y - state.neutral_gaze_y if state.gaze_initialized else 0.0

        should_update_neutral = (
            abs(delta_yaw) < self._yaw * 0.6
            and abs(delta_pitch) < self._pitch * 0.6
            and abs(delta_gaze_x) < self._gaze_horizontal * 0.6
            and abs(delta_gaze_y) < self._gaze_vertical * 0.6
            and not state.candidate_since
        )
        if should_update_neutral:
            state.neutral_yaw = self._neutral_alpha * state.ema_yaw + (1.0 - self._neutral_alpha) * state.neutral_yaw
            state.neutral_pitch = (
                self._neutral_alpha * state.ema_pitch + (1.0 - self._neutral_alpha) * state.neutral_pitch
            )
            if state.gaze_initialized:
                state.neutral_gaze_x = (
                    self._neutral_alpha * state.ema_gaze_x + (1.0 - self._neutral_alpha) * state.neutral_gaze_x
                )
                state.neutral_gaze_y = (
                    self._neutral_alpha * state.ema_gaze_y + (1.0 - self._neutral_alpha) * state.neutral_gaze_y
                )
            delta_yaw = state.ema_yaw - state.neutral_yaw
            delta_pitch = state.ema_pitch - state.neutral_pitch
            delta_gaze_x = state.ema_gaze_x - state.neutral_gaze_x if state.gaze_initialized else 0.0
            delta_gaze_y = state.ema_gaze_y - state.neutral_gaze_y if state.gaze_initialized else 0.0

        ms_since_last = (ts - state.last_trigger_at).total_seconds() * 1000.0
        if ms_since_last < self._cooldown_ms:
            self._update_candidates_without_trigger(state, ts)
            return []

        eye_signal_active = (
            eye_tracking_available
            and state.gaze_initialized
            and (
                abs(delta_gaze_x) >= self._gaze_horizontal * 0.7
                or abs(delta_gaze_y) >= self._gaze_vertical * 0.7
            )
        )

        if eye_signal_active:
            checks = [
                (
                    "NEXT",
                    delta_gaze_x > self._gaze_horizontal,
                    abs(delta_gaze_x) / max(self._gaze_horizontal, 1e-6),
                    f"gaze_x > +{self._gaze_horizontal:.2f} for {self._dwell_ms}ms",
                    "eye_gaze",
                ),
                (
                    "PREV",
                    delta_gaze_x < -self._gaze_horizontal,
                    abs(delta_gaze_x) / max(self._gaze_horizontal, 1e-6),
                    f"gaze_x < -{self._gaze_horizontal:.2f} for {self._dwell_ms}ms",
                    "eye_gaze",
                ),
                (
                    "SCROLL_DOWN",
                    delta_gaze_y > self._gaze_vertical,
                    abs(delta_gaze_y) / max(self._gaze_vertical, 1e-6),
                    f"gaze_y > +{self._gaze_vertical:.2f} for {self._dwell_ms}ms",
                    "eye_gaze",
                ),
                (
                    "SCROLL_UP",
                    delta_gaze_y < -self._gaze_vertical,
                    abs(delta_gaze_y) / max(self._gaze_vertical, 1e-6),
                    f"gaze_y < -{self._gaze_vertical:.2f} for {self._dwell_ms}ms",
                    "eye_gaze",
                ),
            ]
        else:
            checks = [
                (
                    "NEXT",
                    delta_yaw > self._yaw,
                    abs(delta_yaw) / max(self._yaw, 1.0),
                    f"yaw > +{self._yaw:g} for {self._dwell_ms}ms",
                    "head_pose",
                ),
                (
                    "PREV",
                    delta_yaw < -self._yaw,
                    abs(delta_yaw) / max(self._yaw, 1.0),
                    f"yaw < -{self._yaw:g} for {self._dwell_ms}ms",
                    "head_pose",
                ),
                (
                    "SCROLL_DOWN",
                    delta_pitch < -self._pitch,
                    abs(delta_pitch) / max(self._pitch, 1.0),
                    f"pitch < -{self._pitch:g} for {self._dwell_ms}ms",
                    "head_pose",
                ),
                (
                    "SCROLL_UP",
                    delta_pitch > self._pitch,
                    abs(delta_pitch) / max(self._pitch, 1.0),
                    f"pitch > +{self._pitch:g} for {self._dwell_ms}ms",
                    "head_pose",
                ),
            ]

        for command, is_active, ratio, trigger, source in checks:
            if is_active:
                started_at = state.candidate_since.get(command)
                if started_at is None:
                    state.candidate_since[command] = ts
                    continue

                elapsed_ms = (ts - started_at).total_seconds() * 1000.0
                if elapsed_ms >= self._dwell_ms:
                    state.last_trigger_at = ts
                    state.candidate_since.clear()
                    confidence = min(1.0, max(0.3, ratio / 1.4))
                    return [
                        CommandDecision(
                            command=command,
                            trigger=trigger,
                            confidence=confidence,
                            cooldown_ms=self._cooldown_ms,
                            source=source,
                        )
                    ]
            else:
                if eye_signal_active and command in {"NEXT", "PREV"} and abs(delta_gaze_x) < self._gaze_horizontal * 0.72:
                    state.candidate_since.pop(command, None)
                if eye_signal_active and command in {"SCROLL_DOWN", "SCROLL_UP"} and abs(delta_gaze_y) < self._gaze_vertical * 0.72:
                    state.candidate_since.pop(command, None)
                if not eye_signal_active and command in {"NEXT", "PREV"} and abs(delta_yaw) < self._yaw * 0.7:
                    state.candidate_since.pop(command, None)
                if not eye_signal_active and command in {"SCROLL_DOWN", "SCROLL_UP"} and abs(delta_pitch) < self._pitch * 0.7:
                    state.candidate_since.pop(command, None)

        return []

    @staticmethod
    def _update_candidates_without_trigger(state: SessionCommandState, ts: datetime) -> None:
        # Keeps timers warm during cooldown, but avoids stale long-lived candidates.
        for key, started_at in list(state.candidate_since.items()):
            if (ts - started_at).total_seconds() > 5.0:
                state.candidate_since.pop(key, None)


commands_engine = CommandsEngine()

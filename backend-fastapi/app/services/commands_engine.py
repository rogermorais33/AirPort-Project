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


@dataclass
class SessionCommandState:
    ema_yaw: float = 0.0
    ema_pitch: float = 0.0
    initialized: bool = False
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

    def evaluate(self, session_id: UUID, ts: datetime, yaw: float, pitch: float) -> list[CommandDecision]:
        state = self._states.setdefault(session_id, SessionCommandState())

        if not state.initialized:
            state.ema_yaw = yaw
            state.ema_pitch = pitch
            state.initialized = True
        else:
            state.ema_yaw = self._alpha * yaw + (1.0 - self._alpha) * state.ema_yaw
            state.ema_pitch = self._alpha * pitch + (1.0 - self._alpha) * state.ema_pitch

        ms_since_last = (ts - state.last_trigger_at).total_seconds() * 1000.0
        if ms_since_last < self._cooldown_ms:
            self._update_candidates_without_trigger(state, ts)
            return []

        checks = [
            (
                "NEXT",
                state.ema_yaw > self._yaw,
                abs(state.ema_yaw) / max(self._yaw, 1.0),
                f"yaw > +{self._yaw:g} for {self._dwell_ms}ms",
            ),
            (
                "PREV",
                state.ema_yaw < -self._yaw,
                abs(state.ema_yaw) / max(self._yaw, 1.0),
                f"yaw < -{self._yaw:g} for {self._dwell_ms}ms",
            ),
            (
                "SCROLL_DOWN",
                state.ema_pitch < -self._pitch,
                abs(state.ema_pitch) / max(self._pitch, 1.0),
                f"pitch < -{self._pitch:g} for {self._dwell_ms}ms",
            ),
            (
                "SCROLL_UP",
                state.ema_pitch > self._pitch,
                abs(state.ema_pitch) / max(self._pitch, 1.0),
                f"pitch > +{self._pitch:g} for {self._dwell_ms}ms",
            ),
        ]

        for command, is_active, ratio, trigger in checks:
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
                        )
                    ]
            else:
                # Hysteresis release threshold at 70% of trigger magnitude.
                if command in {"NEXT", "PREV"} and abs(state.ema_yaw) < self._yaw * 0.7:
                    state.candidate_since.pop(command, None)
                if command in {"SCROLL_DOWN", "SCROLL_UP"} and abs(state.ema_pitch) < self._pitch * 0.7:
                    state.candidate_since.pop(command, None)

        return []

    @staticmethod
    def _update_candidates_without_trigger(state: SessionCommandState, ts: datetime) -> None:
        # Keeps timers warm during cooldown, but avoids stale long-lived candidates.
        for key, started_at in list(state.candidate_since.items()):
            if (ts - started_at).total_seconds() > 5.0:
                state.candidate_since.pop(key, None)


commands_engine = CommandsEngine()

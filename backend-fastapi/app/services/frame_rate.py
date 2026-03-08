from __future__ import annotations

from datetime import datetime
from threading import Lock


class DeviceFpsLimiter:
    def __init__(self, max_fps: float) -> None:
        self._max_fps = max(max_fps, 0.1)
        self._interval_s = 1.0 / self._max_fps
        self._last_seen: dict[str, datetime] = {}
        self._lock = Lock()

    def allow(self, device_key: str, ts: datetime) -> bool:
        with self._lock:
            prev = self._last_seen.get(device_key)
            if prev is not None and (ts - prev).total_seconds() < self._interval_s:
                return False
            self._last_seen[device_key] = ts
            return True

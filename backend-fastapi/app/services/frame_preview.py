from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from uuid import UUID


@dataclass(slots=True)
class PreviewFrame:
    session_id: UUID
    ts: datetime
    content_type: str
    image_bytes: bytes
    size_bytes: int


class FramePreviewStore:
    """In-memory cache with only the latest frame per session."""

    def __init__(self, *, max_sessions: int = 128, max_frame_bytes: int = 350_000) -> None:
        self._max_sessions = max(1, max_sessions)
        self._max_frame_bytes = max(8_000, max_frame_bytes)
        self._frames: OrderedDict[UUID, PreviewFrame] = OrderedDict()
        self._lock = Lock()

    def put(self, session_id: UUID, frame_bytes: bytes, *, content_type: str = "image/jpeg") -> None:
        if not frame_bytes:
            return
        if len(frame_bytes) > self._max_frame_bytes:
            return

        frame = PreviewFrame(
            session_id=session_id,
            ts=datetime.now(timezone.utc),
            content_type=content_type,
            image_bytes=frame_bytes,
            size_bytes=len(frame_bytes),
        )

        with self._lock:
            if session_id in self._frames:
                self._frames.pop(session_id, None)
            self._frames[session_id] = frame
            self._frames.move_to_end(session_id, last=True)

            while len(self._frames) > self._max_sessions:
                self._frames.popitem(last=False)

    def get(self, session_id: UUID) -> PreviewFrame | None:
        with self._lock:
            frame = self._frames.get(session_id)
            if frame is None:
                return None
            # Keep most active sessions as newest.
            self._frames.move_to_end(session_id, last=True)
            return frame


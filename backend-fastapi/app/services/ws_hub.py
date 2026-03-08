from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class WsClient:
    websocket: WebSocket
    session_id: UUID | None


class LiveWebSocketHub:
    def __init__(self, max_clients: int) -> None:
        self._max_clients = max(1, max_clients)
        self._clients: dict[WebSocket, WsClient] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, session_id: UUID | None) -> bool:
        async with self._lock:
            if len(self._clients) >= self._max_clients:
                await websocket.accept()
                await websocket.send_json(
                    {
                        "type": "overloaded",
                        "message": "Max websocket clients reached",
                        "timestamp": _utc_iso(),
                    }
                )
                await websocket.close(code=1013, reason="Overloaded")
                return False

            await websocket.accept()
            self._clients[websocket] = WsClient(websocket=websocket, session_id=session_id)

        await websocket.send_json(
            {
                "type": "connected",
                "session_id": str(session_id) if session_id else None,
                "timestamp": _utc_iso(),
            }
        )

        logger.info("ws connected session_id=%s clients=%s", session_id, len(self._clients))
        return True

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.pop(websocket, None)
        logger.info("ws disconnected clients=%s", len(self._clients))

    async def send_event(
        self,
        event_type: str,
        payload: dict[str, Any],
        *,
        session_id: UUID | None = None,
    ) -> None:
        if not self._clients:
            return

        stale: list[WebSocket] = []
        message = {
            "type": event_type,
            "timestamp": _utc_iso(),
            "data": payload,
        }

        for ws, client in list(self._clients.items()):
            if session_id and client.session_id and client.session_id != session_id:
                continue
            if session_id and client.session_id is None:
                # Global listeners should still receive all events.
                pass

            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)

        if stale:
            async with self._lock:
                for ws in stale:
                    self._clients.pop(ws, None)


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

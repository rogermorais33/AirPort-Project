from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from app.core.config import get_settings
from app.models.sensor import SensorReadingIn

logger = logging.getLogger(__name__)


class ReadingsWebSocketHub:
    def __init__(self, max_clients: int) -> None:
        self._clients: dict[WebSocket, str | None] = {}
        self._max_clients = max(1, max_clients)

    async def connect(self, websocket: WebSocket, device_id: str | None) -> bool:
        if len(self._clients) >= self._max_clients:
            await websocket.accept()
            await websocket.send_json(
                {
                    "type": "overloaded",
                    "message": "Limite de conexoes em tempo real atingido. Tente novamente em instantes.",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            await websocket.close(code=1013, reason="Server overloaded")
            logger.warning("WebSocket rejected by capacity limit=%s", self._max_clients)
            return False

        await websocket.accept()
        self._clients[websocket] = device_id
        logger.info("WebSocket connected device_filter=%s clients=%s", device_id, len(self._clients))

        await websocket.send_json(
            {
                "type": "connected",
                "device_id": device_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return True

    async def disconnect(self, websocket: WebSocket) -> None:
        self._clients.pop(websocket, None)
        logger.info("WebSocket disconnected clients=%s", len(self._clients))

    async def broadcast_reading(self, payload: SensorReadingIn) -> None:
        if not self._clients:
            return

        message = {
            "type": "reading_ingested",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": payload.model_dump(mode="json"),
        }

        stale_connections: list[WebSocket] = []
        for websocket, device_filter in list(self._clients.items()):
            if device_filter and device_filter != payload.device_id:
                continue

            try:
                await websocket.send_json(message)
            except Exception:
                stale_connections.append(websocket)

        for websocket in stale_connections:
            self._clients.pop(websocket, None)

    async def send_message(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        await websocket.send_json(message)


settings = get_settings()
readings_ws_hub = ReadingsWebSocketHub(max_clients=settings.ws_max_clients)

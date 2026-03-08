from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["ws"])


@router.websocket("/ws/live")
async def live_stream(websocket: WebSocket, session_id: UUID | None = Query(default=None)) -> None:
    connected = await websocket.app.state.ws_hub.connect(websocket, session_id=session_id)
    if not connected:
        return

    try:
        while True:
            message = await websocket.receive_text()
            if message.strip().lower() == "ping":
                await websocket.send_json(
                    {
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
    except WebSocketDisconnect:
        await websocket.app.state.ws_hub.disconnect(websocket)
    except Exception:
        await websocket.app.state.ws_hub.disconnect(websocket)

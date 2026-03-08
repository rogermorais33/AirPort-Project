from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import get_settings
from app.db.session import init_db
from app.services.frame_pipeline import FramePipelineService
from app.services.frame_queue import FrameQueueManager
from app.services.ws_hub import LiveWebSocketHub

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_create_tables:
        init_db()

    ws_hub = LiveWebSocketHub(max_clients=settings.ws_max_clients)
    frame_pipeline = FramePipelineService(ws_hub=ws_hub)
    frame_queue = FrameQueueManager(pipeline=frame_pipeline)

    app.state.ws_hub = ws_hub
    app.state.frame_pipeline = frame_pipeline
    app.state.frame_queue = frame_queue

    await frame_queue.start()
    yield
    await frame_queue.shutdown()


app = FastAPI(
    title=settings.app_name,
    description="GazePilot backend for ESP32-CAM gaze/head tracking, heatmap and commands.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "GazePilot API", "status": "ok"}

from __future__ import annotations

import asyncio
import base64
import json
import logging
from dataclasses import dataclass
from uuid import UUID

from redis import Redis

from app.core.config import get_settings
from app.services.frame_pipeline import FramePipelineService

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass(slots=True)
class FrameJob:
    frame_event_id: UUID
    frame_bytes: bytes


class FrameQueueManager:
    def __init__(self, pipeline: FramePipelineService) -> None:
        self._pipeline = pipeline
        self._mode = settings.frame_queue_mode.strip().lower()
        self._memory_queue: asyncio.Queue[FrameJob] = asyncio.Queue(maxsize=settings.frame_queue_maxsize)
        self._memory_task: asyncio.Task[None] | None = None
        self._redis: Redis | None = None

        if settings.redis_enabled:
            self._redis = Redis.from_url(settings.redis_url, decode_responses=False)

    @property
    def mode(self) -> str:
        return self._mode

    async def start(self) -> None:
        if self._mode == "memory" and self._memory_task is None:
            self._memory_task = asyncio.create_task(self._memory_worker())

    async def shutdown(self) -> None:
        if self._memory_task is not None:
            self._memory_task.cancel()
            try:
                await self._memory_task
            except asyncio.CancelledError:
                pass
            self._memory_task = None

    async def submit(self, job: FrameJob) -> str:
        if self._mode == "sync":
            await asyncio.to_thread(self._pipeline.process_frame_event, job.frame_event_id, job.frame_bytes)
            return "done"

        if self._mode == "redis" and self._redis is not None:
            payload = {
                "frame_event_id": str(job.frame_event_id),
                "frame_b64": base64.b64encode(job.frame_bytes).decode("ascii"),
            }
            self._redis.rpush(settings.redis_queue_name, json.dumps(payload).encode("utf-8"))
            return "queued"

        await self._memory_queue.put(job)
        return "queued"

    async def _memory_worker(self) -> None:
        while True:
            job = await self._memory_queue.get()
            try:
                await asyncio.to_thread(self._pipeline.process_frame_event, job.frame_event_id, job.frame_bytes)
            except Exception:  # pragma: no cover
                logger.exception("memory worker failed frame_event_id=%s", job.frame_event_id)
            finally:
                self._memory_queue.task_done()


def consume_redis_job_blocking(pipeline: FramePipelineService, timeout_s: int = 3) -> bool:
    redis_client = Redis.from_url(settings.redis_url, decode_responses=False)
    item = redis_client.blpop(settings.redis_queue_name, timeout=timeout_s)
    if not item:
        return False

    _, payload_raw = item
    payload = json.loads(payload_raw.decode("utf-8"))
    frame_event_id = UUID(payload["frame_event_id"])
    frame_bytes = base64.b64decode(payload["frame_b64"])
    pipeline.process_frame_event(frame_event_id, frame_bytes)
    return True

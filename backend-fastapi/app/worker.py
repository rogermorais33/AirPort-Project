from __future__ import annotations

import logging
import time

from app.services.frame_pipeline import FramePipelineService
from app.services.frame_queue import consume_redis_job_blocking
from app.services.ws_hub import LiveWebSocketHub

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("gazepilot.worker")


def main() -> None:
    logger.info("Starting Redis frame worker")
    pipeline = FramePipelineService(ws_hub=LiveWebSocketHub(max_clients=1))

    while True:
        try:
            consumed = consume_redis_job_blocking(pipeline, timeout_s=5)
            if not consumed:
                time.sleep(0.1)
        except KeyboardInterrupt:
            logger.info("Worker interrupted")
            break
        except Exception:
            logger.exception("Worker loop error")
            time.sleep(1.0)


if __name__ == "__main__":
    main()

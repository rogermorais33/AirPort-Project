from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

TEST_DB_PATH = Path("./test_gazepilot.db")


@pytest.fixture(scope="session", autouse=True)
def setup_test_env() -> None:
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{TEST_DB_PATH}?check_same_thread=false"
    os.environ["FRAME_QUEUE_MODE"] = "sync"
    os.environ["REDIS_ENABLED"] = "false"
    os.environ["AUTO_CREATE_TABLES"] = "true"

    from app.core.config import get_settings

    get_settings.cache_clear()

    yield

    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture()
def client(setup_test_env) -> TestClient:
    from app.db.base import Base
    from app.db.session import engine
    from app.main import app

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)

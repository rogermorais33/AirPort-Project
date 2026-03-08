from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import SchemaBase


class SessionStartIn(SchemaBase):
    device_id: UUID
    screen_w: int | None = Field(default=None, ge=1, le=10000)
    screen_h: int | None = Field(default=None, ge=1, le=10000)
    mode: str = Field(default="mvp", pattern="^(mvp|calibration)$")


class SessionOut(SchemaBase):
    id: UUID
    device_id: UUID
    started_at: datetime
    ended_at: datetime | None
    screen_w: int | None
    screen_h: int | None
    mode: str
    active: bool


class SessionStartOut(SchemaBase):
    session: SessionOut


class SessionEndOut(SchemaBase):
    session_id: UUID
    active: bool
    ended_at: datetime


class PageStartIn(SchemaBase):
    url: str = Field(..., min_length=3, max_length=2048)
    title: str | None = Field(default=None, max_length=255)


class PageStartOut(SchemaBase):
    id: UUID
    session_id: UUID
    url: str
    title: str | None
    started_at: datetime

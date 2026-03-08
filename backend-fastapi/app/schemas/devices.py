from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import SchemaBase, utc_now


class DeviceRegisterIn(SchemaBase):
    name: str = Field(..., min_length=2, max_length=120)
    fw_version: str | None = Field(default=None, max_length=48)


class DeviceRegisterOut(SchemaBase):
    id: UUID
    device_key: str
    name: str
    created_at: datetime
    fw_version: str | None


class DeviceHeartbeatIn(SchemaBase):
    device_id: UUID
    device_key: str
    fw_version: str | None = Field(default=None, max_length=48)


class DeviceHeartbeatOut(SchemaBase):
    status: str
    device_id: UUID
    last_seen_at: datetime = Field(default_factory=utc_now)


class DeviceConfigOut(SchemaBase):
    device_id: UUID
    fps: int
    quality: int
    resolution: str
    max_frame_bytes: int

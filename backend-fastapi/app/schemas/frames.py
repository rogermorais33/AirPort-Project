from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import SchemaBase, utc_now


class FrameAcceptedOut(SchemaBase):
    status: str
    frame_event_id: UUID
    processing_status: str
    accepted_at: datetime = Field(default_factory=utc_now)

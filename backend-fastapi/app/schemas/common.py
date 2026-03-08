from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict


class SchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)

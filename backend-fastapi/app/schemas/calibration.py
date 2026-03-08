from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import SchemaBase


class CalibrationProfileCreate(SchemaBase):
    device_id: UUID
    name: str = Field(..., min_length=2, max_length=120)
    model_type: str = Field(default="linear_regression", max_length=64)


class CalibrationProfileOut(SchemaBase):
    id: UUID
    device_id: UUID
    name: str
    created_at: datetime
    model_type: str
    points_count: int


class CalibrationPointCreate(SchemaBase):
    target_x: float
    target_y: float
    features_json: dict[str, float] | None = None
    session_id: UUID | None = None


class CalibrationPointOut(SchemaBase):
    id: UUID
    profile_id: UUID
    target_x: float
    target_y: float
    created_at: datetime


class CalibrationTrainOut(SchemaBase):
    profile_id: UUID
    model_type: str
    points_count: int
    training_error: float

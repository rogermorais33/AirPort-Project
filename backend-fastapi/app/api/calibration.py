from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import CalibrationPoint, CalibrationProfile, Device
from app.schemas.calibration import (
    CalibrationPointCreate,
    CalibrationPointOut,
    CalibrationProfileCreate,
    CalibrationProfileOut,
    CalibrationTrainOut,
)
from app.services.frame_pipeline import latest_features_for_session
from app.services.gaze_mapper import train_linear_model

router = APIRouter(prefix="/calibration", tags=["calibration"])


@router.post("/profile", response_model=CalibrationProfileOut, status_code=201)
def create_profile(payload: CalibrationProfileCreate, db: Session = Depends(get_db)) -> CalibrationProfileOut:
    device = db.get(Device, payload.device_id)
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    profile = CalibrationProfile(
        device_id=payload.device_id,
        name=payload.name,
        model_type=payload.model_type,
        params_json={},
        points_count=0,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return CalibrationProfileOut.model_validate(profile)


@router.post("/{profile_id}/point", response_model=CalibrationPointOut, status_code=201)
def add_point(
    profile_id: UUID,
    payload: CalibrationPointCreate,
    db: Session = Depends(get_db),
) -> CalibrationPointOut:
    profile = db.get(CalibrationProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Calibration profile not found")

    features = payload.features_json
    if features is None and payload.session_id is not None:
        features = latest_features_for_session(payload.session_id)

    if features is None:
        raise HTTPException(status_code=400, detail="Missing features_json or session_id with available metrics")

    point = CalibrationPoint(
        profile_id=profile.id,
        target_x=payload.target_x,
        target_y=payload.target_y,
        features_json={k: float(v) for k, v in features.items() if k != "timestamp"},
    )
    db.add(point)

    profile.points_count = int((profile.points_count or 0) + 1)

    db.commit()
    db.refresh(point)
    return CalibrationPointOut.model_validate(point)


@router.post("/{profile_id}/train", response_model=CalibrationTrainOut)
def train_profile(profile_id: UUID, db: Session = Depends(get_db)) -> CalibrationTrainOut:
    profile = db.get(CalibrationProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Calibration profile not found")

    points = db.scalars(
        select(CalibrationPoint).where(CalibrationPoint.profile_id == profile.id).order_by(CalibrationPoint.created_at)
    ).all()
    if len(points) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 points for training")

    model, mae = train_linear_model(
        [
            {
                "target_x": point.target_x,
                "target_y": point.target_y,
                "features_json": point.features_json,
            }
            for point in points
        ]
    )

    profile.model_type = model["model_type"]
    profile.params_json = model
    profile.points_count = len(points)

    db.commit()

    return CalibrationTrainOut(
        profile_id=profile.id,
        model_type=profile.model_type,
        points_count=profile.points_count,
        training_error=mae,
    )


@router.get("/profiles/{device_id}", response_model=list[CalibrationProfileOut])
def list_profiles(device_id: UUID, db: Session = Depends(get_db)) -> list[CalibrationProfileOut]:
    rows = db.scalars(
        select(CalibrationProfile)
        .where(CalibrationProfile.device_id == device_id)
        .order_by(CalibrationProfile.created_at.desc())
        .limit(100)
    ).all()
    return [CalibrationProfileOut.model_validate(row) for row in rows]


@router.get("/profiles/{profile_id}/points")
def count_points(profile_id: UUID, db: Session = Depends(get_db)) -> dict[str, int]:
    points_count = db.scalar(select(func.count()).select_from(CalibrationPoint).where(CalibrationPoint.profile_id == profile_id))
    return {"points_count": int(points_count or 0)}

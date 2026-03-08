from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.calibration import router as calibration_router
from app.api.devices import router as devices_router
from app.api.frames import router as frames_router
from app.api.health import health_status
from app.api.reports import router as reports_router
from app.api.sessions import router as sessions_router
from app.api.ws import router as ws_router
from app.db.session import get_db
from app.schemas.health import HealthOut

api_router = APIRouter(prefix="/api/v1")


@api_router.get("/health", response_model=HealthOut)
def health(request: Request, db: Session = Depends(get_db)) -> HealthOut:
    cv_status = {}
    frame_pipeline = getattr(request.app.state, "frame_pipeline", None)
    if frame_pipeline is not None and hasattr(frame_pipeline, "cv_diagnostics"):
        cv_status = frame_pipeline.cv_diagnostics()
    return health_status(db, cv_status=cv_status)


api_router.include_router(devices_router)
api_router.include_router(sessions_router)
api_router.include_router(frames_router)
api_router.include_router(calibration_router)
api_router.include_router(reports_router)
api_router.include_router(ws_router)

from fastapi import FastAPI

from app.api.readings import router as readings_router
from app.core.config import get_settings
from app.services.influx import influx_service

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="API de telemetria para ESP32 + BME680 (qualidade do ar)",
)


@app.on_event("startup")
def startup_event() -> None:
    if influx_service.ping():
        try:
            influx_service.ensure_bucket()
        except Exception:
            # A API continua no ar mesmo se o bucket nao puder ser criado.
            pass


app.include_router(readings_router)

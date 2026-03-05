from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AirPort Sensor API"
    app_env: str = "dev"
    app_port: int = 8000

    influx_url: str = "http://localhost:8086"
    influx_token: str = "change-me"
    influx_org: str = "airport-project"
    influx_bucket: str = "airport_telemetry"
    influx_retention_days: int = 30
    ws_max_clients: int = 200

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

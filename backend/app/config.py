from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables.
    Copy .env.example to .env and fill in your values.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- Database ---
    # Driver: psycopg (psycopg3) — pre-built binaries for Python 3.14
    database_url: str = "postgresql+psycopg://postgres:password@localhost:5432/labourbook"

    # --- App ---
    app_env: str = "development"
    secret_key: str = "change-me-to-a-random-32-char-string"

    # --- CORS ---
    cors_origins: List[str] = ["http://localhost:3000"]

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"


# Single shared instance — import this throughout the app
settings = Settings()

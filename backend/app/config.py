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

    # --- Auth (Google Sign-In) ---
    google_client_id: str = ""
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # --- Supabase Storage ---
    # Required for farm operation photo uploads.
    # Set these in your .env file:
    #   SUPABASE_URL=https://your-project.supabase.co
    #   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    #   SUPABASE_STORAGE_BUCKET=farm-media
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "farm-media"

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"


# Single shared instance — import this throughout the app
settings = Settings()

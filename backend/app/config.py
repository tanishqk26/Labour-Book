from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
    ]

    # --- Auth (Google Sign-In) ---
    google_client_id: str = ""
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # --- Supabase Storage ---
    # Dashboard API keys (new names) and the legacy service-role name are both accepted.
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "farm-media"

    @model_validator(mode="after")
    def _ensure_local_cors(self):
        """Keep Expo web and the Next app allowed in development even if .env lists one origin."""
        if self.app_env == "development":
            extras = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:8081",
                "http://127.0.0.1:8081",
                "http://localhost:8082",
                "http://127.0.0.1:8082",
            ]
            origins = list(self.cors_origins or [])
            for origin in extras:
                if origin not in origins:
                    origins.append(origin)
            self.cors_origins = origins
        return self

    @model_validator(mode="after")
    def _normalize_supabase_keys(self):
        secret = (self.supabase_secret_key or "").strip()
        role = (self.supabase_service_role_key or "").strip()
        if not role and secret:
            role = secret
        self.supabase_secret_key = secret
        self.supabase_service_role_key = role
        self.supabase_publishable_key = (self.supabase_publishable_key or "").strip()
        return self

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"


# Single shared instance — import this throughout the app
settings = Settings()

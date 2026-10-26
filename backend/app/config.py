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
    # Base list — always allowed (local dev).
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
    ]
    # On Render / Vercel: set EXTRA_CORS_ORIGINS as a plain comma-separated string.
    # e.g.  EXTRA_CORS_ORIGINS=https://labour-book.vercel.app,https://www.myapp.com
    extra_cors_origins: str = ""

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
        origins = list(self.cors_origins or [])

        # Merge EXTRA_CORS_ORIGINS (plain comma-separated string, safe on Render).
        if self.extra_cors_origins:
            for o in self.extra_cors_origins.split(","):
                o = o.strip()
                if o and o not in origins:
                    origins.append(o)

        # Keep local dev origins in development.
        if self.app_env == "development":
            for o in [
                "http://localhost:3000", "http://127.0.0.1:3000",
                "http://localhost:3001", "http://127.0.0.1:3001",
                "http://localhost:8081", "http://127.0.0.1:8081",
                "http://localhost:8082", "http://127.0.0.1:8082",
            ]:
                if o not in origins:
                    origins.append(o)

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

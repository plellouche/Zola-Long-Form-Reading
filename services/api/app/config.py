from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_jwt_secret: str = Field(..., alias="SUPABASE_JWT_SECRET")
    database_url: str = Field(..., alias="DATABASE_URL")
    admin_bootstrap_emails: str = Field(default="", alias="ADMIN_BOOTSTRAP_EMAILS")
    # Optional: when set, main.py initializes Sentry. Unset = silent no-op.
    sentry_dsn: str = Field(default="", alias="SENTRY_DSN")
    sentry_environment: str = Field(default="production", alias="SENTRY_ENVIRONMENT")

    @property
    def admin_emails(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_bootstrap_emails.split(",") if e.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

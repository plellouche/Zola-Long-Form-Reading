"""Configuration loaded from .env / environment."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

USER_AGENT = "Longform/0.1 (+https://github.com/longform-reading-app)"
REQUEST_TIMEOUT = 20.0  # seconds
MAX_CONCURRENT_PER_HOST = 2
ROBOTS_CACHE_TTL_SECONDS = 60 * 60 * 6  # 6 hours
MAX_CONSECUTIVE_FAILURES = 5


def _find_env_file() -> Path | None:
    """Walk up from CWD looking for a .env file. Falls back to /etc/longform/.env."""
    cwd = Path.cwd().resolve()
    for parent in [cwd, *cwd.parents]:
        candidate = parent / ".env"
        if candidate.is_file():
            return candidate
    # Last-resort container-style location
    for candidate in (Path("/etc/longform/.env"),):
        if candidate.is_file():
            return candidate
    return None


def _load_env_once() -> None:
    env_path = _find_env_file()
    if env_path is not None:
        load_dotenv(env_path, override=False)


@lru_cache(maxsize=1)
def database_url() -> str:
    """Return DATABASE_URL stripped of any SQLAlchemy driver prefix.

    `services/api` uses `postgresql+asyncpg://...` for SQLAlchemy; asyncpg
    direct expects `postgresql://...`.
    """
    _load_env_once()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set; see .env.example")
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)

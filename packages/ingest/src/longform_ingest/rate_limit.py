"""Per-host concurrency limit. Each remote host gets its own semaphore."""

from __future__ import annotations

import asyncio
from urllib.parse import urlparse

from .config import MAX_CONCURRENT_PER_HOST

_semaphores: dict[str, asyncio.Semaphore] = {}


def host_semaphore(url: str) -> asyncio.Semaphore:
    host = urlparse(url).netloc.lower()
    sem = _semaphores.get(host)
    if sem is None:
        sem = asyncio.Semaphore(MAX_CONCURRENT_PER_HOST)
        _semaphores[host] = sem
    return sem

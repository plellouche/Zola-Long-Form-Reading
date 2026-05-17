"""robots.txt compliance cache."""

from __future__ import annotations

import time
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

from .config import REQUEST_TIMEOUT, ROBOTS_CACHE_TTL_SECONDS, USER_AGENT


class RobotsCache:
    def __init__(self) -> None:
        # host -> (RobotFileParser | None, expires_at_epoch)
        self._cache: dict[str, tuple[RobotFileParser | None, float]] = {}

    async def is_allowed(self, client: httpx.AsyncClient, url: str) -> bool:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if not host:
            return True

        now = time.time()
        cached = self._cache.get(host)
        if cached is not None and cached[1] > now:
            parser = cached[0]
            return True if parser is None else parser.can_fetch(USER_AGENT, url)

        robots_url = f"{parsed.scheme}://{host}/robots.txt"
        parser: RobotFileParser | None = None
        try:
            resp = await client.get(robots_url, timeout=REQUEST_TIMEOUT, follow_redirects=True)
            if resp.status_code == 200 and resp.text:
                parser = RobotFileParser()
                parser.parse(resp.text.splitlines())
            # else: treat as no rules → allowed
        except httpx.HTTPError:
            # Network error fetching robots.txt → allow (don't block ingestion on transient issues)
            parser = None

        self._cache[host] = (parser, now + ROBOTS_CACHE_TTL_SECONDS)
        return True if parser is None else parser.can_fetch(USER_AGENT, url)

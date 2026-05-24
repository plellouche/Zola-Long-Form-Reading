"""Archive strategy — walks a master "all articles" index page.

For sources that publish a hand-curated index of every essay they've ever
written. Examples:
  - paulgraham.com/articles.html
  - laphamsquarterly.org/archive
  - publicdomainreview.org/essays

Each source declares `archive_url` + `archive_link_selector` (CSS selector
applied to the index page; matched <a href> tags become candidate URLs).

The strategy then visits each candidate URL once, extracts OpenGraph
metadata, and emits ArticleCandidates with title/author/og_image/etc.
"""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import urljoin

import asyncpg
import httpx
from bs4 import BeautifulSoup

from ..config import REQUEST_TIMEOUT, USER_AGENT
from ..og import fetch_og
from ..rate_limit import host_semaphore
from ..robots import RobotsCache
from .base import ArticleCandidate, Strategy, StrategyResult

log = logging.getLogger("longform.ingest.archive")

# Cap per-source candidate count to avoid runaway crawls on misconfigured
# selectors. 500 is plenty for paulgraham.com (~225 essays) and most
# magazine archives.
MAX_CANDIDATES_PER_SOURCE = 500


class ArchiveStrategy(Strategy):
    async def fetch(
        self,
        *,
        client: httpx.AsyncClient,
        source: asyncpg.Record,
        robots: RobotsCache,
    ) -> StrategyResult:
        archive_url = source["archive_url"]
        selector = source["archive_link_selector"] or "a[href]"
        if not archive_url:
            return StrategyResult(status="ERROR", error_message="archive_url not configured")

        if not await robots.is_allowed(client, archive_url):
            return StrategyResult(status="BLOCKED", http_status=0,
                                  error_message="robots.txt disallowed")

        try:
            async with host_semaphore(archive_url):
                resp = await client.get(
                    archive_url,
                    headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"},
                    timeout=REQUEST_TIMEOUT,
                    follow_redirects=True,
                )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            return StrategyResult(status="ERROR", error_message=str(exc))

        soup = BeautifulSoup(resp.text, "html.parser")
        anchors = soup.select(selector)
        # Resolve relative -> absolute, dedup, cap.
        urls: list[str] = []
        seen: set[str] = set()
        for a in anchors:
            href = a.get("href")
            if not href:
                continue
            href = urljoin(str(resp.url), href.strip())
            if href.startswith("javascript:") or href.startswith("mailto:") or href.startswith("#"):
                continue
            if href in seen:
                continue
            seen.add(href)
            urls.append(href)
            if len(urls) >= MAX_CANDIDATES_PER_SOURCE:
                break

        log.info("archive %s: %d candidate URLs", source["slug"], len(urls))

        min_word_count = source["min_word_count"] or 0
        candidates: list[ArticleCandidate] = []

        # Sequential per host (the host_semaphore inside fetch_og keeps this
        # polite). We're optimizing for back-fill safety, not speed.
        for url in urls:
            try:
                meta = await fetch_og(client, url, robots)
            except httpx.HTTPError as exc:
                log.warning("archive %s: skip %s (%s)", source["slug"], url, exc)
                continue
            if meta is None:
                continue
            if not meta.title:
                continue
            if min_word_count > 0 and (meta.word_count or 0) < min_word_count:
                continue
            candidates.append(
                ArticleCandidate(
                    title=meta.title,
                    canonical_url=meta.canonical_url,
                    author=meta.author,
                    publication_date=meta.publication_date,
                    description=meta.description,
                    og_image_url=meta.og_image_url,
                    word_count=meta.word_count,
                    reading_time_minutes=meta.reading_time_minutes,
                )
            )

        return StrategyResult(
            status="OK", candidates=candidates, http_status=resp.status_code,
        )

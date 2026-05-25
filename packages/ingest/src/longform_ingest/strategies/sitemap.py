"""Sitemap strategy — walks sitemap.xml (with index recursion).

For sources whose long-form content is mixed into a larger publication
(news + features + landing pages + tags). The sitemap exposes every URL;
we filter by `sitemap_url_pattern` (a regex) to keep only the URLs that
look like real articles.

Example pattern for The New Yorker: `^https://www\\.newyorker\\.com/magazine/\\d+/`
keeps only the magazine-feature URLs and excludes the news desk + tags + author pages.

After URL filtering, each URL is visited once for metadata. A per-source
`min_word_count` floor filters out anything short of long-form.
"""

from __future__ import annotations

import logging
import re
from xml.etree import ElementTree

import asyncpg
import httpx

from ..config import REQUEST_TIMEOUT, USER_AGENT
from ..og import fetch_og
from ..rate_limit import host_semaphore
from ..robots import RobotsCache
from .base import ArticleCandidate, Strategy, StrategyResult

log = logging.getLogger("longform.ingest.sitemap")

# Sitemap.xml namespace used by sitemaps.org schema.
SM_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# Hard cap to avoid runaway crawls. Most magazine sitemaps that match a
# targeted url_pattern fit comfortably under this.
MAX_CANDIDATES_PER_SOURCE = 500


async def _fetch_xml(
    client: httpx.AsyncClient, url: str
) -> ElementTree.Element | None:
    async with host_semaphore(url):
        resp = await client.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/xml,text/xml,*/*"},
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        )
    if resp.status_code >= 400:
        return None
    try:
        return ElementTree.fromstring(resp.content)
    except ElementTree.ParseError as exc:
        log.warning("sitemap parse error %s: %s", url, exc)
        return None


async def _walk_sitemap(
    client: httpx.AsyncClient,
    url: str,
    visited: set[str],
    pattern: re.Pattern[str] | None,
    out: list[str],
    cap: int,
) -> None:
    if url in visited:
        return
    visited.add(url)
    root = await _fetch_xml(client, url)
    if root is None:
        return

    tag = root.tag.split("}")[-1]   # strip namespace
    if tag == "sitemapindex":
        # Each <sitemap><loc>…</loc></sitemap> points to another sitemap.
        for el in root.findall("sm:sitemap/sm:loc", SM_NS):
            if len(out) >= cap:
                return
            child_url = (el.text or "").strip()
            if child_url:
                await _walk_sitemap(client, child_url, visited, pattern, out, cap)
    elif tag == "urlset":
        for el in root.findall("sm:url/sm:loc", SM_NS):
            if len(out) >= cap:
                return
            url_text = (el.text or "").strip()
            if not url_text:
                continue
            if pattern is not None and not pattern.search(url_text):
                continue
            out.append(url_text)


class SitemapStrategy(Strategy):
    async def fetch(
        self,
        *,
        client: httpx.AsyncClient,
        source: asyncpg.Record,
        robots: RobotsCache,
    ) -> StrategyResult:
        sitemap_url = source["sitemap_url"]
        url_pattern_str = source["sitemap_url_pattern"]
        if not sitemap_url:
            return StrategyResult(status="ERROR", error_message="sitemap_url not configured")
        pattern = re.compile(url_pattern_str) if url_pattern_str else None

        urls: list[str] = []
        visited: set[str] = set()
        try:
            await _walk_sitemap(client, sitemap_url, visited, pattern,
                                urls, MAX_CANDIDATES_PER_SOURCE)
        except httpx.HTTPError as exc:
            return StrategyResult(status="ERROR", error_message=str(exc))

        log.info("sitemap %s: %d matching URLs (visited %d sitemaps)",
                 source["slug"], len(urls), len(visited))

        min_word_count = source["min_word_count"] or 0
        candidates: list[ArticleCandidate] = []

        for url in urls:
            try:
                meta = await fetch_og(client, url, robots)
            except httpx.HTTPError as exc:
                log.warning("sitemap %s: skip %s (%s)", source["slug"], url, exc)
                continue
            if meta is None or not meta.title:
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
                    access_tier=meta.access_tier,
                )
            )

        return StrategyResult(status="OK", candidates=candidates)

"""RSS / Atom feed fetcher with conditional GET."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

import feedparser
import httpx
from dateutil import parser as date_parser

from .config import REQUEST_TIMEOUT, USER_AGENT
from .rate_limit import host_semaphore
from .robots import RobotsCache


@dataclass(frozen=True)
class FeedItem:
    title: str
    canonical_url: str
    author: str | None
    publication_date: date | None
    description: str | None
    og_image_url: str | None


@dataclass(frozen=True)
class FeedFetchResult:
    items: list[FeedItem]
    etag: str | None
    last_modified: str | None
    http_status: int
    not_modified: bool  # True if server returned 304


def _parse_pub_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        dt = date_parser.parse(value)
        return dt.date()
    except (ValueError, TypeError, OverflowError):
        return None


def _extract_image(entry: dict) -> str | None:
    """Pull a best-guess image from a feedparser entry."""
    media = entry.get("media_content") or entry.get("media_thumbnail")
    if isinstance(media, list) and media:
        url = media[0].get("url")
        if url:
            return url
    enclosures = entry.get("enclosures") or []
    for enc in enclosures:
        if str(enc.get("type", "")).startswith("image/") and enc.get("href"):
            return enc["href"]
    if entry.get("image"):
        img = entry["image"]
        if isinstance(img, dict) and img.get("href"):
            return img["href"]
        if isinstance(img, str):
            return img
    return None


def _parse_entries(parsed: feedparser.FeedParserDict) -> list[FeedItem]:
    items: list[FeedItem] = []
    for entry in parsed.entries:
        link = (entry.get("link") or "").strip()
        title = (entry.get("title") or "").strip()
        if not link or not title:
            continue
        author = (entry.get("author") or "").strip() or None
        # Some feeds put HTML in 'summary'; we accept it raw for now.
        description = (entry.get("summary") or "").strip() or None
        pub = entry.get("published") or entry.get("updated") or entry.get("created")
        items.append(
            FeedItem(
                title=title,
                canonical_url=link,
                author=author,
                publication_date=_parse_pub_date(pub),
                description=description,
                og_image_url=_extract_image(entry),
            )
        )
    return items


async def fetch_feed(
    client: httpx.AsyncClient,
    rss_url: str,
    *,
    etag: str | None,
    last_modified: str | None,
    robots: RobotsCache,
) -> FeedFetchResult:
    """Fetch and parse an RSS feed. Sends conditional GET headers; returns
    `not_modified=True` on HTTP 304."""

    if not await robots.is_allowed(client, rss_url):
        return FeedFetchResult([], etag, last_modified, 0, False)

    headers = {"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8"}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    async with host_semaphore(rss_url):
        resp = await client.get(
            rss_url, headers=headers, timeout=REQUEST_TIMEOUT, follow_redirects=True
        )

    if resp.status_code == 304:
        return FeedFetchResult([], etag, last_modified, 304, True)
    resp.raise_for_status()

    parsed = feedparser.parse(resp.content)
    items = _parse_entries(parsed)

    new_etag = resp.headers.get("ETag") or etag
    new_modified = resp.headers.get("Last-Modified") or last_modified
    return FeedFetchResult(items, new_etag, new_modified, resp.status_code, False)

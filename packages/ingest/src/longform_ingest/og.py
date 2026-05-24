"""OpenGraph + fallback HTML metadata fetcher for individual URLs."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import httpx
from bs4 import BeautifulSoup
from dateutil import parser as date_parser

from .config import REQUEST_TIMEOUT, USER_AGENT
from .rate_limit import host_semaphore
from .robots import RobotsCache


@dataclass(frozen=True)
class OgMetadata:
    canonical_url: str
    title: str | None
    description: str | None
    author: str | None
    publication_date: date | None
    og_image_url: str | None
    word_count: int | None = None
    reading_time_minutes: int | None = None


def _attr(soup: BeautifulSoup, *selectors: tuple[str, dict[str, str]]) -> str | None:
    """Try a series of (tag, attrs) selectors. Returns the first matching content/value."""
    for tag, attrs in selectors:
        el = soup.find(tag, attrs=attrs)
        if el is None:
            continue
        for key in ("content", "value", "href"):
            v = el.get(key)
            if v:
                return v.strip()
    return None


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date_parser.parse(value).date()
    except (ValueError, TypeError, OverflowError):
        return None


def _estimate_word_count(soup: BeautifulSoup) -> int:
    """Rough body-text word count. Strips scripts/styles/nav/header/footer
    and counts whitespace-separated tokens in what remains. Good enough for
    a min-length filter; nowhere near accurate enough to display."""
    for el in soup(["script", "style", "noscript", "nav", "header", "footer", "aside", "form"]):
        el.decompose()
    # Prefer <article> or <main> when available; fall back to <body>.
    container = soup.find("article") or soup.find("main") or soup.body or soup
    text = " ".join(container.stripped_strings)
    return len(text.split())


def parse_html(url: str, html: str) -> OgMetadata:
    soup = BeautifulSoup(html, "html.parser")

    canonical = (
        _attr(soup, ("link", {"rel": "canonical"}))
        or _attr(soup, ("meta", {"property": "og:url"}))
        or url
    )
    title = (
        _attr(soup, ("meta", {"property": "og:title"}))
        or (soup.title.string.strip() if soup.title and soup.title.string else None)
    )
    description = (
        _attr(soup, ("meta", {"property": "og:description"}))
        or _attr(soup, ("meta", {"name": "description"}))
    )
    author = (
        _attr(soup, ("meta", {"name": "author"}))
        or _attr(soup, ("meta", {"property": "article:author"}))
    )
    pub_raw = (
        _attr(soup, ("meta", {"property": "article:published_time"}))
        or _attr(soup, ("meta", {"name": "publish-date"}))
        or _attr(soup, ("meta", {"name": "date"}))
        or _attr(soup, ("time", {}))
    )
    image = (
        _attr(soup, ("meta", {"property": "og:image"}))
        or _attr(soup, ("meta", {"name": "twitter:image"}))
    )

    word_count = _estimate_word_count(soup)
    # ~225 wpm is a reasonable average for long-form reading.
    reading_time = max(1, round(word_count / 225)) if word_count else None

    return OgMetadata(
        canonical_url=canonical,
        title=title,
        description=description,
        author=author,
        publication_date=_parse_date(pub_raw),
        og_image_url=image,
        word_count=word_count or None,
        reading_time_minutes=reading_time,
    )


async def fetch_og(
    client: httpx.AsyncClient,
    url: str,
    robots: RobotsCache,
) -> OgMetadata | None:
    """Returns parsed OG metadata, or None if robots.txt disallows or the page is non-HTML."""
    if not await robots.is_allowed(client, url):
        return None

    async with host_semaphore(url):
        resp = await client.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"},
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        )
    if resp.status_code >= 400:
        return None
    content_type = resp.headers.get("Content-Type", "")
    if "html" not in content_type.lower():
        return None

    return parse_html(str(resp.url), resp.text)

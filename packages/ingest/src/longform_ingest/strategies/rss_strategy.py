"""RSS strategy — thin wrapper around the existing rss.fetch_feed pipeline."""

from __future__ import annotations

import asyncpg
import httpx

from ..robots import RobotsCache
from ..rss import fetch_feed
from .base import ArticleCandidate, Strategy, StrategyResult


class RssStrategy(Strategy):
    async def fetch(
        self,
        *,
        client: httpx.AsyncClient,
        source: asyncpg.Record,
        robots: RobotsCache,
    ) -> StrategyResult:
        if not source["rss_url"]:
            return StrategyResult(status="NO_RSS")

        try:
            feed = await fetch_feed(
                client,
                source["rss_url"],
                etag=source["last_ingest_etag"],
                last_modified=source["last_ingest_modified"],
                robots=robots,
            )
        except httpx.HTTPError as exc:
            return StrategyResult(status="ERROR", error_message=str(exc))

        if feed.http_status == 0:
            return StrategyResult(status="BLOCKED", http_status=0,
                                  error_message="robots.txt disallowed")
        if feed.not_modified:
            return StrategyResult(status="NO_CHANGES", http_status=304,
                                  etag=feed.etag, last_modified=feed.last_modified)

        candidates = [
            ArticleCandidate(
                title=item.title,
                canonical_url=item.canonical_url,
                author=item.author,
                publication_date=item.publication_date,
                description=item.description,
                og_image_url=item.og_image_url,
            )
            for item in feed.items
        ]
        return StrategyResult(
            status="OK",
            candidates=candidates,
            http_status=feed.http_status,
            etag=feed.etag,
            last_modified=feed.last_modified,
        )

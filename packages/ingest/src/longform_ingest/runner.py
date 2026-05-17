"""Top-level orchestration: ingest one source or all sources."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import asyncpg
import httpx

from . import db
from .config import MAX_CONSECUTIVE_FAILURES, REQUEST_TIMEOUT, USER_AGENT
from .robots import RobotsCache
from .rss import fetch_feed
from .topics import merge_topic_scores, score_text

log = logging.getLogger("longform.ingest")


@dataclass
class SourceIngestResult:
    source_slug: str
    status: str  # OK | NO_CHANGES | NO_RSS | BLOCKED | ERROR
    articles_seen: int = 0
    articles_inserted: int = 0
    http_status: int | None = None
    error_message: str | None = None

    def __str__(self) -> str:
        base = f"[{self.status}] {self.source_slug} seen={self.articles_seen} inserted={self.articles_inserted}"
        if self.error_message:
            base += f" error={self.error_message[:120]}"
        return base


async def _ingest_one(
    *,
    client: httpx.AsyncClient,
    conn: asyncpg.Connection,
    source: asyncpg.Record,
    topic_ids_by_slug: dict[str, Any],
    robots: RobotsCache,
    triggered_by: str,
) -> SourceIngestResult:
    started_at = datetime.now(timezone.utc)
    slug = source["slug"]

    if not source["rss_url"]:
        result = SourceIngestResult(source_slug=slug, status="NO_RSS")
        await db.update_source_ingest_state(
            conn, source_id=source["id"], status="NO_RSS",
            etag=source["last_ingest_etag"], last_modified=source["last_ingest_modified"],
            inserted_count=0, error=None,
        )
        await db.insert_ingestion_run(
            conn, source_id=source["id"], status="NO_RSS", articles_seen=0,
            articles_inserted=0, http_status=None, error_message=None,
            triggered_by=triggered_by, started_at=started_at,
        )
        return result

    try:
        feed = await fetch_feed(
            client,
            source["rss_url"],
            etag=source["last_ingest_etag"],
            last_modified=source["last_ingest_modified"],
            robots=robots,
        )
    except httpx.HTTPError as exc:
        result = SourceIngestResult(
            source_slug=slug, status="ERROR", error_message=str(exc),
        )
        await db.update_source_ingest_state(
            conn, source_id=source["id"], status="ERROR",
            etag=source["last_ingest_etag"], last_modified=source["last_ingest_modified"],
            inserted_count=0, error=str(exc),
        )
        await db.deactivate_if_failing(conn, source["id"], MAX_CONSECUTIVE_FAILURES)
        await db.insert_ingestion_run(
            conn, source_id=source["id"], status="ERROR",
            articles_seen=0, articles_inserted=0,
            http_status=None, error_message=str(exc),
            triggered_by=triggered_by, started_at=started_at,
        )
        return result

    if feed.http_status == 0:
        # robots blocked
        await db.update_source_ingest_state(
            conn, source_id=source["id"], status="BLOCKED",
            etag=source["last_ingest_etag"], last_modified=source["last_ingest_modified"],
            inserted_count=0, error="robots.txt disallowed",
        )
        await db.insert_ingestion_run(
            conn, source_id=source["id"], status="BLOCKED",
            articles_seen=0, articles_inserted=0, http_status=0,
            error_message="robots.txt disallowed",
            triggered_by=triggered_by, started_at=started_at,
        )
        return SourceIngestResult(source_slug=slug, status="BLOCKED", http_status=0)

    if feed.not_modified:
        await db.update_source_ingest_state(
            conn, source_id=source["id"], status="NO_CHANGES",
            etag=feed.etag, last_modified=feed.last_modified,
            inserted_count=0, error=None,
        )
        await db.insert_ingestion_run(
            conn, source_id=source["id"], status="NO_CHANGES",
            articles_seen=0, articles_inserted=0, http_status=304,
            error_message=None, triggered_by=triggered_by, started_at=started_at,
        )
        return SourceIngestResult(
            source_slug=slug, status="NO_CHANGES", http_status=304,
        )

    defaults = await db.get_source_default_topics(conn, source["id"])
    inserted = 0
    for item in feed.items:
        article_id = await db.insert_article(
            conn,
            source_id=source["id"],
            title=item.title,
            canonical_url=item.canonical_url,
            author=item.author,
            publication_date=item.publication_date,
            description=item.description,
            og_image_url=item.og_image_url,
            content_policy=source["content_policy"],
        )
        if article_id is None:
            continue  # already exists, skip
        inserted += 1

        text = " ".join(filter(None, [item.title, item.description]))
        scored = merge_topic_scores(score_text(text), defaults)
        attachments = [
            (topic_ids_by_slug[slug], weight)
            for slug, weight in scored
            if slug in topic_ids_by_slug
        ]
        await db.attach_topics(conn, article_id=article_id, topic_id_weights=attachments)

    await db.update_source_ingest_state(
        conn, source_id=source["id"], status="OK",
        etag=feed.etag, last_modified=feed.last_modified,
        inserted_count=inserted, error=None,
    )
    await db.insert_ingestion_run(
        conn, source_id=source["id"], status="OK",
        articles_seen=len(feed.items), articles_inserted=inserted,
        http_status=feed.http_status, error_message=None,
        triggered_by=triggered_by, started_at=started_at,
    )
    return SourceIngestResult(
        source_slug=slug, status="OK", articles_seen=len(feed.items),
        articles_inserted=inserted, http_status=feed.http_status,
    )


async def ingest_all(triggered_by: str = "cron") -> list[SourceIngestResult]:
    robots = RobotsCache()
    results: list[SourceIngestResult] = []

    async with httpx.AsyncClient() as client, db.connection() as conn:
        sources = await db.list_active_sources(conn)
        topic_ids = await db.get_topic_ids_by_slug(conn)

        for src in sources:
            try:
                result = await _ingest_one(
                    client=client, conn=conn, source=src,
                    topic_ids_by_slug=topic_ids, robots=robots,
                    triggered_by=triggered_by,
                )
            except Exception as exc:  # noqa: BLE001 — log everything
                log.exception("Unhandled error ingesting %s", src["slug"])
                result = SourceIngestResult(
                    source_slug=src["slug"], status="ERROR", error_message=str(exc),
                )
            log.info("%s", result)
            results.append(result)

    return results


async def ingest_source_by_slug(slug: str, triggered_by: str = "admin") -> SourceIngestResult:
    robots = RobotsCache()
    async with httpx.AsyncClient() as client, db.connection() as conn:
        src = await db.get_source_by_slug(conn, slug)
        if src is None:
            return SourceIngestResult(
                source_slug=slug, status="ERROR", error_message="Source not found",
            )
        topic_ids = await db.get_topic_ids_by_slug(conn)
        return await _ingest_one(
            client=client, conn=conn, source=src,
            topic_ids_by_slug=topic_ids, robots=robots,
            triggered_by=triggered_by,
        )

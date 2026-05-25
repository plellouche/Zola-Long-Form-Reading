"""Top-level orchestration: ingest one source or all sources.

The runner is strategy-agnostic — for each source it dispatches to the
appropriate strategy adapter (RSS / archive / sitemap / manual), takes
the returned candidates, and runs the same insert + tag pipeline.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import asyncpg
import httpx

from . import db
from .config import MAX_CONSECUTIVE_FAILURES
from .robots import RobotsCache
from .strategies import for_source
from .strategies.base import StrategyResult
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


async def _persist_candidates(
    *,
    conn: asyncpg.Connection,
    source: asyncpg.Record,
    result: StrategyResult,
    topic_ids_by_slug: dict[str, Any],
) -> int:
    """Insert candidate articles + topics for one strategy round. Returns count inserted."""
    defaults = await db.get_source_default_topics(conn, source["id"])
    inserted = 0
    for cand in result.candidates:
        article_id = await db.insert_article(
            conn,
            source_id=source["id"],
            title=cand.title,
            canonical_url=cand.canonical_url,
            author=cand.author,
            publication_date=cand.publication_date,
            description=cand.description,
            og_image_url=cand.og_image_url,
            content_policy=source["content_policy"],
            word_count=cand.word_count,
            reading_time_minutes=cand.reading_time_minutes,
            access_tier=cand.access_tier,
        )
        if article_id is None:
            continue
        inserted += 1
        text = " ".join(filter(None, [cand.title, cand.description]))
        scored = merge_topic_scores(score_text(text), defaults)
        attachments = [
            (topic_ids_by_slug[slug], weight)
            for slug, weight in scored
            if slug in topic_ids_by_slug
        ]
        await db.attach_topics(conn, article_id=article_id, topic_id_weights=attachments)
    return inserted


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

    strategy = for_source(source["fetch_strategy"])
    try:
        result = await strategy.fetch(client=client, source=source, robots=robots)
    except Exception as exc:  # noqa: BLE001 — strategies should not raise; if one does, isolate it
        log.exception("strategy error for %s", slug)
        result = StrategyResult(status="ERROR", error_message=str(exc))

    inserted = 0
    if result.status == "OK":
        inserted = await _persist_candidates(
            conn=conn, source=source, result=result, topic_ids_by_slug=topic_ids_by_slug,
        )

    # Persist state. For non-RSS strategies etag/last_modified stay as-is on
    # the source row; the RSS strategy populates them via StrategyResult.
    await db.update_source_ingest_state(
        conn,
        source_id=source["id"],
        status=result.status,
        etag=result.etag if result.etag is not None else source["last_ingest_etag"],
        last_modified=result.last_modified if result.last_modified is not None
                      else source["last_ingest_modified"],
        inserted_count=inserted,
        error=result.error_message,
    )
    if result.status == "ERROR":
        await db.deactivate_if_failing(conn, source["id"], MAX_CONSECUTIVE_FAILURES)
    await db.insert_ingestion_run(
        conn,
        source_id=source["id"],
        status=result.status,
        articles_seen=len(result.candidates),
        articles_inserted=inserted,
        http_status=result.http_status,
        error_message=result.error_message,
        triggered_by=triggered_by,
        started_at=started_at,
    )

    return SourceIngestResult(
        source_slug=slug,
        status=result.status,
        articles_seen=len(result.candidates),
        articles_inserted=inserted,
        http_status=result.http_status,
        error_message=result.error_message,
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

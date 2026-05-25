"""Thin asyncpg wrapper. Decouples the ingest package from services/api's SQLAlchemy."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import asyncpg

from .config import database_url


@asynccontextmanager
async def connection() -> AsyncIterator[asyncpg.Connection]:
    # statement_cache_size=0 is required when running through Supabase's
    # transaction-mode pooler (Supavisor / pgbouncer-style). Prepared statements
    # don't survive across pooled transactions, so asyncpg's default cache
    # raises DuplicatePreparedStatementError. Setting it to 0 forces ad-hoc
    # query execution. Cost is negligible at our scale; documented in
    # COMMAND_CENTER §15.
    conn = await asyncpg.connect(database_url(), statement_cache_size=0)
    try:
        yield conn
    finally:
        await conn.close()


_SOURCE_COLUMNS = """
    id, slug, name, homepage_url, rss_url, content_policy,
    last_ingest_etag, last_ingest_modified, consecutive_failures,
    fetch_strategy, archive_url, archive_link_selector,
    sitemap_url, sitemap_url_pattern, min_word_count
"""


async def list_active_sources(conn: asyncpg.Connection) -> list[asyncpg.Record]:
    return await conn.fetch(
        f"""
        select {_SOURCE_COLUMNS}
        from public.sources
        where is_active = true
        order by name
        """
    )


async def get_source_by_slug(conn: asyncpg.Connection, slug: str) -> asyncpg.Record | None:
    return await conn.fetchrow(
        f"""
        select {_SOURCE_COLUMNS}
        from public.sources
        where slug = $1
        """,
        slug,
    )


async def get_source_default_topics(
    conn: asyncpg.Connection, source_id: Any
) -> dict[str, float]:
    rows = await conn.fetch(
        """
        select t.slug, sdt.weight
        from public.source_default_topics sdt
        join public.topics t on t.id = sdt.topic_id
        where sdt.source_id = $1
        """,
        source_id,
    )
    return {r["slug"]: float(r["weight"]) for r in rows}


async def get_topic_ids_by_slug(conn: asyncpg.Connection) -> dict[str, Any]:
    rows = await conn.fetch("select id, slug from public.topics")
    return {r["slug"]: r["id"] for r in rows}


async def insert_article(
    conn: asyncpg.Connection,
    *,
    source_id: Any,
    title: str,
    canonical_url: str,
    author: str | None,
    publication_date,
    description: str | None,
    og_image_url: str | None,
    content_policy: str,
    word_count: int | None = None,
    reading_time_minutes: int | None = None,
    access_tier: str = "unknown",
) -> Any | None:
    """Insert one article. Returns id, or None on canonical_url collision."""
    return await conn.fetchval(
        """
        insert into public.articles (
          source_id, title, canonical_url, author, publication_date,
          description, og_image_url, content_policy,
          word_count, reading_time_minutes, access_tier
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (canonical_url) do nothing
        returning id
        """,
        source_id, title, canonical_url, author, publication_date,
        description, og_image_url, content_policy,
        word_count, reading_time_minutes, access_tier,
    )


async def attach_topics(
    conn: asyncpg.Connection,
    *,
    article_id: Any,
    topic_id_weights: list[tuple[Any, float]],
) -> None:
    if not topic_id_weights:
        return
    await conn.executemany(
        """
        insert into public.article_topics (article_id, topic_id, weight)
        values ($1, $2, $3)
        on conflict (article_id, topic_id) do nothing
        """,
        [(article_id, tid, w) for tid, w in topic_id_weights],
    )


async def update_source_ingest_state(
    conn: asyncpg.Connection,
    *,
    source_id: Any,
    status: str,
    etag: str | None,
    last_modified: str | None,
    inserted_count: int,
    error: str | None,
) -> None:
    failures_delta = 0 if status in ("OK", "NO_CHANGES") else 1
    await conn.execute(
        """
        update public.sources
        set last_ingested_at = now(),
            last_ingest_status = $2,
            last_ingest_etag = $3,
            last_ingest_modified = $4,
            last_ingest_article_count = $5,
            last_ingest_error = $6,
            consecutive_failures = case when $7 = 0 then 0 else consecutive_failures + 1 end
        where id = $1
        """,
        source_id, status, etag, last_modified, inserted_count, error, failures_delta,
    )


async def deactivate_if_failing(
    conn: asyncpg.Connection, source_id: Any, threshold: int
) -> bool:
    """Mark source inactive after `threshold` consecutive failures. Returns True if disabled."""
    return bool(
        await conn.fetchval(
            """
            update public.sources
            set is_active = false
            where id = $1 and consecutive_failures >= $2 and is_active = true
            returning true
            """,
            source_id, threshold,
        )
    )


async def insert_ingestion_run(
    conn: asyncpg.Connection,
    *,
    source_id: Any | None,
    status: str,
    articles_seen: int,
    articles_inserted: int,
    http_status: int | None,
    error_message: str | None,
    triggered_by: str,
    started_at,
) -> None:
    await conn.execute(
        """
        insert into public.ingestion_runs (
          source_id, started_at, finished_at, status,
          articles_seen, articles_inserted, http_status, error_message, triggered_by
        )
        values ($1, $2, now(), $3, $4, $5, $6, $7, $8)
        """,
        source_id, started_at, status, articles_seen, articles_inserted,
        http_status, error_message, triggered_by,
    )

"""One-off: re-score topic tags on every existing article using the current
keyword heuristic. Run when `topics.py` keyword lists change.

Usage:
    cd packages/ingest
    DATABASE_URL=postgres://... python -m longform_ingest.retag

Behavior:
- Walks public.articles.
- For each article, recomputes topic scores from title + description, blended
  with the article's source's default-topic priors.
- Replaces public.article_topics rows for that article with the new set.

Idempotent. Wraps each article in a transaction so partial failures don't
corrupt state.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from typing import Any

import asyncpg

from .topics import merge_topic_scores, score_text

log = logging.getLogger("longform.retag")


async def _topic_ids_by_slug(conn: asyncpg.Connection) -> dict[str, Any]:
    rows = await conn.fetch("select id, slug from public.topics")
    return {r["slug"]: r["id"] for r in rows}


async def _source_defaults(conn: asyncpg.Connection, source_id: Any) -> dict[str, float]:
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


async def retag_all(database_url: str) -> None:
    conn = await asyncpg.connect(database_url)
    try:
        topic_ids = await _topic_ids_by_slug(conn)
        articles = await conn.fetch(
            "select id, source_id, title, description from public.articles order by created_at"
        )
        log.info("retagging %d articles", len(articles))

        # Cache source defaults so we don't refetch per article.
        defaults_cache: dict[Any, dict[str, float]] = {}

        kept = 0
        changed = 0
        for art in articles:
            text = " ".join(s for s in (art["title"], art["description"]) if s)
            text_scores = score_text(text)
            source_id = art["source_id"]
            if source_id not in defaults_cache:
                defaults_cache[source_id] = await _source_defaults(conn, source_id)
            scored = merge_topic_scores(text_scores, defaults_cache[source_id])

            new_pairs = [(topic_ids[slug], weight) for slug, weight in scored if slug in topic_ids]

            async with conn.transaction():
                existing = await conn.fetch(
                    "select topic_id, weight from public.article_topics where article_id = $1",
                    art["id"],
                )
                existing_set = {(r["topic_id"], round(float(r["weight"]), 4)) for r in existing}
                new_set = {(tid, round(w, 4)) for tid, w in new_pairs}
                if existing_set == new_set:
                    kept += 1
                    continue
                await conn.execute(
                    "delete from public.article_topics where article_id = $1", art["id"]
                )
                if new_pairs:
                    await conn.executemany(
                        """
                        insert into public.article_topics (article_id, topic_id, weight)
                        values ($1, $2, $3)
                        """,
                        [(art["id"], tid, w) for tid, w in new_pairs],
                    )
                changed += 1

        log.info("done: %d unchanged, %d updated", kept, changed)
    finally:
        await conn.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(2)
    # The repo stores DATABASE_URL with the +asyncpg driver suffix; asyncpg
    # itself doesn't recognise the driver hint, so strip it.
    asyncpg_url = database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    asyncio.run(retag_all(asyncpg_url))


if __name__ == "__main__":
    main()

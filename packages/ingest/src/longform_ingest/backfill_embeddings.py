"""Backfill embeddings for articles where `articles.embedding IS NULL`.

Usage:
    python -m longform_ingest.backfill_embeddings [--limit N] [--batch 32]

Run after `python -m longform_ingest --all`. Designed for the GHA cron — see
.github/workflows/ingest.yml. Locally, requires the embeddings optional dep:

    pip install -e 'packages/ingest[embeddings]'

The model loads once per process. Articles are processed in DB-driven batches
so the script can be Ctrl-C'd at any point without partial-batch loss.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from collections import Counter

from .db import connection
from .embeddings import article_input_text, compute_embeddings_batch

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger("backfill_embeddings")


async def run(*, limit: int | None, batch_size: int) -> None:
    counts: Counter[str] = Counter()
    processed = 0

    async with connection() as conn:
        # Article fetch + update inside the same conn so we can use prepared
        # statements implicitly. Pull a window at a time so we don't load
        # 10k+ rows into memory.
        offset = 0
        while True:
            remaining = None if limit is None else max(0, limit - processed)
            if remaining == 0:
                break

            window = batch_size if remaining is None else min(batch_size, remaining)
            rows = await conn.fetch(
                """
                select id, title, description, author
                from public.articles
                where embedding is null
                order by created_at desc
                limit $1
                """,
                window,
            )
            if not rows:
                break

            texts = [
                article_input_text(
                    r["title"], r["description"], r["author"]
                )
                for r in rows
            ]
            try:
                vectors = compute_embeddings_batch(texts)
            except Exception:
                log.exception("batch encode failed; skipping window")
                counts["error"] += len(rows)
                offset += len(rows)
                continue

            # pgvector accepts string form '[0.1,0.2,...]' via asyncpg by default
            # (without registering a custom codec). Format here:
            updates = [
                (
                    "[" + ",".join(f"{v:.6f}" for v in vec) + "]",
                    row["id"],
                )
                for row, vec in zip(rows, vectors, strict=True)
            ]
            async with conn.transaction():
                await conn.executemany(
                    "update public.articles set embedding = $1::vector where id = $2",
                    updates,
                )

            counts["ok"] += len(rows)
            processed += len(rows)
            log.info("embedded %d articles (running total %d)", len(rows), processed)

    log.info("DONE  %s", dict(counts))


def main() -> None:
    p = argparse.ArgumentParser(description="Backfill articles.embedding.")
    p.add_argument("--limit", type=int, default=None,
                   help="Stop after N articles (default: until table is full)")
    p.add_argument("--batch", type=int, default=32,
                   help="DB window size + encode batch size (default 32)")
    args = p.parse_args()
    asyncio.run(run(limit=args.limit, batch_size=args.batch))


if __name__ == "__main__":
    main()

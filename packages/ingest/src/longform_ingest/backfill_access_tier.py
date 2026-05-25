"""One-shot backfill: detect access_tier for every article with tier='unknown'.

Re-fetches each article URL, parses the publisher-emitted content_tier meta
(see og._detect_access_tier), updates the row. Skips robots-disallowed URLs.

Usage from repo root:

    services/api/.venv/bin/python -m longform_ingest.backfill_access_tier \
        [--source SLUG] [--limit N] [--dry-run]

Default: process every 'unknown' article, polite per-host concurrency,
commits in batches of 50. Safe to run multiple times.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from collections import Counter

import httpx

from .config import REQUEST_TIMEOUT, USER_AGENT
from .db import connection
from .og import _detect_access_tier, ACCESS_TIERS
from .rate_limit import host_semaphore
from .robots import RobotsCache

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger("backfill_access_tier")

BATCH_SIZE = 50


async def _detect_for_url(
    client: httpx.AsyncClient, url: str, robots: RobotsCache
) -> str | None:
    """Fetch + parse one URL. Returns tier ('free'|'metered'|'locked'|'unknown')
    or None on hard error / robots disallow."""
    if not await robots.is_allowed(client, url):
        return None
    try:
        async with host_semaphore(url):
            resp = await client.get(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"},
                timeout=REQUEST_TIMEOUT,
                follow_redirects=True,
            )
    except httpx.HTTPError as exc:
        log.warning("fetch failed for %s: %s", url, exc)
        return None
    if resp.status_code >= 400:
        return None
    if "html" not in resp.headers.get("Content-Type", "").lower():
        return None

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(resp.text, "html.parser")
    return _detect_access_tier(soup)


async def run(source_slug: str | None, limit: int | None, dry_run: bool) -> None:
    where_clauses = ["a.access_tier = 'unknown'"]
    params: list = []
    if source_slug:
        where_clauses.append("s.slug = $1")
        params.append(source_slug)
    where_sql = " and ".join(where_clauses)
    limit_sql = f" limit {limit}" if limit else ""

    sql = f"""
        select a.id, a.canonical_url, s.slug as source_slug
        from public.articles a
        join public.sources s on s.id = a.source_id
        where {where_sql}
        order by a.created_at desc
        {limit_sql}
    """

    robots = RobotsCache()
    counts: Counter[str] = Counter()
    processed = 0

    async with httpx.AsyncClient() as client, connection() as conn:
        rows = await conn.fetch(sql, *params)
        log.info("found %d articles to process (source=%s, limit=%s, dry_run=%s)",
                 len(rows), source_slug or "ALL", limit, dry_run)

        batch: list[tuple[str, str]] = []  # (tier, article_id)

        for i, row in enumerate(rows, start=1):
            tier = await _detect_for_url(client, row["canonical_url"], robots)
            if tier is None:
                counts["error_or_blocked"] += 1
            else:
                counts[tier] += 1
                if not dry_run and tier in ACCESS_TIERS:
                    batch.append((tier, row["id"]))
            processed += 1

            if i % 25 == 0:
                log.info("progress: %d/%d  counts=%s",
                         i, len(rows), dict(counts))

            if len(batch) >= BATCH_SIZE:
                await _flush_batch(conn, batch)
                batch.clear()

        if batch:
            await _flush_batch(conn, batch)

    log.info("DONE  processed=%d  %s", processed, dict(counts))


async def _flush_batch(conn, batch: list[tuple[str, str]]) -> None:
    """Update access_tier for a batch of (tier, article_id) pairs."""
    async with conn.transaction():
        await conn.executemany(
            "update public.articles set access_tier = $1 where id = $2",
            batch,
        )


def main() -> None:
    p = argparse.ArgumentParser(
        description="Backfill articles.access_tier for rows currently set to 'unknown'."
    )
    p.add_argument("--source", help="Limit to one source slug")
    p.add_argument("--limit", type=int, default=None, help="Stop after N articles")
    p.add_argument("--dry-run", action="store_true",
                   help="Parse + print but don't write")
    args = p.parse_args()
    asyncio.run(run(args.source, args.limit, args.dry_run))


if __name__ == "__main__":
    main()

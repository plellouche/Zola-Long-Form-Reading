"""Entry point: `python -m longform_ingest --all` or `--source <slug>`."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

import httpx

from . import db
from .og import fetch_og
from .robots import RobotsCache
from .runner import ingest_all, ingest_source_by_slug


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s  %(levelname)-5s  %(name)s  %(message)s",
        stream=sys.stderr,
    )


async def _run_url(url: str) -> int:
    robots = RobotsCache()
    async with httpx.AsyncClient() as client:
        meta = await fetch_og(client, url, robots)
    if meta is None:
        print("Could not fetch metadata (robots disallowed or non-HTML response).")
        return 2
    print(f"title:       {meta.title}")
    print(f"canonical:   {meta.canonical_url}")
    print(f"author:      {meta.author}")
    print(f"pub date:    {meta.publication_date}")
    print(f"description: {meta.description}")
    print(f"og image:    {meta.og_image_url}")
    return 0


async def _run_main(args: argparse.Namespace) -> int:
    if args.url:
        return await _run_url(args.url)

    fail_statuses = {"ERROR"}

    if args.source:
        # Single-source: explicit ask, surface ERROR as job failure.
        result = await ingest_source_by_slug(args.source, triggered_by="cli")
        print(result)
        return 1 if result.status in fail_statuses else 0

    if args.all:
        # Batch: per-source errors are expected (anti-bot, transient 5xx,
        # source-side rate limits). They're already recorded in
        # ingestion_runs and sources.last_ingest_error. Only fail the job
        # if MORE THAN HALF of sources errored, which signals something
        # systemic (DB down, network outage, our bug).
        results = await ingest_all(triggered_by="cli")
        errors = sum(1 for r in results if r.status in fail_statuses)
        new = sum(r.articles_inserted for r in results)
        print(f"\n{len(results) - errors}/{len(results)} sources OK; {new} new article(s) inserted.")
        if errors:
            print(f"{errors} source(s) errored — see logs above and sources.last_ingest_error in DB.")
        return 1 if errors * 2 > len(results) else 0

    print("Specify --all, --source <slug>, or --url <url>.", file=sys.stderr)
    return 2


def main() -> None:
    parser = argparse.ArgumentParser(prog="longform-ingest")
    parser.add_argument("--all", action="store_true", help="Ingest every active source")
    parser.add_argument("--source", metavar="SLUG", help="Ingest a single source by slug")
    parser.add_argument("--url", metavar="URL", help="Fetch OG metadata for a URL; print and exit")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()
    _setup_logging(args.verbose)
    raise SystemExit(asyncio.run(_run_main(args)))


if __name__ == "__main__":
    main()

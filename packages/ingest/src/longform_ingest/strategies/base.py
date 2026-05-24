"""Shared types for fetch strategies.

A `Strategy` enumerates candidate articles for one source. The runner takes
the candidates, inserts them into the DB (deduping by canonical_url), and
attaches topics. Each strategy can choose how to discover candidates:
RSS feed, archive index page, sitemap.xml, etc.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date

import asyncpg
import httpx

from ..robots import RobotsCache


@dataclass(frozen=True)
class ArticleCandidate:
    """A discovered article — what the runner needs to insert one row.

    Most fields are optional because different discovery mechanisms expose
    different metadata. The runner gracefully handles missing fields.
    """

    title: str
    canonical_url: str
    author: str | None = None
    publication_date: date | None = None
    description: str | None = None
    og_image_url: str | None = None
    word_count: int | None = None
    reading_time_minutes: int | None = None


@dataclass
class StrategyResult:
    """What a strategy returns to the runner after one fetch round."""

    status: str  # OK | NO_CHANGES | NO_RSS | BLOCKED | ERROR
    candidates: list[ArticleCandidate] = field(default_factory=list)
    http_status: int | None = None
    error_message: str | None = None
    # RSS-specific state that gets persisted on the source row so we can do
    # conditional GETs next time. Other strategies leave these None.
    etag: str | None = None
    last_modified: str | None = None


class Strategy(ABC):
    """Abstract base for fetch strategies."""

    @abstractmethod
    async def fetch(
        self,
        *,
        client: httpx.AsyncClient,
        source: asyncpg.Record,
        robots: RobotsCache,
    ) -> StrategyResult:
        """Discover candidate articles for `source`.

        Implementations are responsible for respecting robots.txt
        (the RobotsCache helper handles this) and for not hammering
        the source (use `rate_limit.host_semaphore` for per-host concurrency).
        """
        raise NotImplementedError

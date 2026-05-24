"""Per-source fetch strategies.

Each source declares a `fetch_strategy` (see migration 009). The runner
dispatches to one of these implementations:

- rss      — wraps the existing feedparser-based pipeline
- archive  — walks a master "all essays" index page (e.g. paulgraham.com/articles.html)
- sitemap  — walks sitemap.xml (with index recursion), filters by URL pattern
- manual   — no-op; articles only arrive via admin URL submission

All strategies return a `StrategyResult` that the runner converts into
articles + topics rows.
"""

from .base import (
    ArticleCandidate,
    Strategy,
    StrategyResult,
)
from .archive import ArchiveStrategy
from .manual import ManualStrategy
from .rss_strategy import RssStrategy
from .sitemap import SitemapStrategy


def for_source(strategy_name: str) -> Strategy:
    """Return the strategy adapter for a `sources.fetch_strategy` value."""
    name = (strategy_name or "rss").lower()
    if name == "rss":
        return RssStrategy()
    if name == "archive":
        return ArchiveStrategy()
    if name == "sitemap":
        return SitemapStrategy()
    if name == "manual":
        return ManualStrategy()
    raise ValueError(f"Unknown fetch_strategy: {strategy_name!r}")


__all__ = [
    "ArticleCandidate",
    "Strategy",
    "StrategyResult",
    "ArchiveStrategy",
    "ManualStrategy",
    "RssStrategy",
    "SitemapStrategy",
    "for_source",
]

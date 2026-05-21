"""Recommendation engine.

Lives inside services/api for Phase 7 — invoked directly from FastAPI
routes. Pure Python + SQLAlchemy (no numpy / pandas) because at our scale
topic vectors are sparse (1-3 topics per article) and dict-based cosine
is faster than instantiating dense arrays.

Migration path documented in COMMAND_CENTER §15:
- ~50k articles: swap keyword-derived topic vectors for sentence-embedding
  vectors stored in a pgvector column; this module's interface stays the same.
- ~100k articles: add pgvector HNSW index for ANN-search instead of the
  in-process scan.
- Higher write rates: precompute scores per user nightly into a feed_cache
  table; routes read from cache and only fall back to live scoring on miss.

See feed.py for the main entry points.
"""

from .feed import for_discover_deck, for_you_feed, list_recommendations, related_articles

__all__ = [
    "for_discover_deck",
    "for_you_feed",
    "list_recommendations",
    "related_articles",
]

"""Server-side embedding helper for semantic search queries.

Wraps the same sentence-transformers/all-MiniLM-L6-v2 used by the ingest
backfill. Loaded lazily — the model adds ~250MB RAM, so we only pay for
it the first time a semantic-search query arrives.

Off by default (config.semantic_search_enabled). Enabled means:
  1. SEMANTIC_SEARCH_ENABLED=true in the runtime env
  2. sentence-transformers + torch are pip-installed in the API venv
  3. The Render service has at least Starter-tier RAM (512MB is tight)

When the flag is off OR the import fails, semantic search routes fall
back to keyword search silently.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

log = logging.getLogger("zola.embeddings")

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _model() -> Any | None:
    """Returns the loaded model or None if sentence-transformers isn't
    importable in this runtime (e.g. base API deploy without the heavy ML
    deps). Cached so the next call is a no-op."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        log.info(
            "sentence-transformers not installed; semantic search disabled"
        )
        return None
    log.info("loading embedding model %s (first call only)", MODEL_NAME)
    return SentenceTransformer(MODEL_NAME)


def embed_query(text: str) -> list[float] | None:
    """Returns a 384-d normalized vector for the search query, or None when
    the runtime can't load the model. Caller decides the fallback."""
    text = (text or "").strip()
    if not text:
        return None
    m = _model()
    if m is None:
        return None
    vec = m.encode(text, normalize_embeddings=True)
    return [float(x) for x in vec.tolist()]

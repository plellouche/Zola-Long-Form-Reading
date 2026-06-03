"""Sentence-transformer embeddings for articles.

Uses `sentence-transformers/all-MiniLM-L6-v2` — 384-dim, ~80MB model,
CPU-runnable in <50ms per article on a modern laptop. Loaded lazily so
imports don't trigger the model download for callers that don't need it
(e.g. the production API doesn't compute embeddings; only the GHA backfill
job does).

To install the optional dependency:
    pip install -e 'packages/ingest[embeddings]'

Embedding input text = title + ' ' + description + ' ' + (author or '').
Truncated to model's 256-token context implicitly via the tokenizer.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

log = logging.getLogger("longform.ingest.embeddings")

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


@lru_cache(maxsize=1)
def _model() -> Any:
    """Lazy-load the sentence-transformer. Cached so subsequent calls are free."""
    from sentence_transformers import SentenceTransformer

    log.info("loading embedding model %s (first call only)", MODEL_NAME)
    return SentenceTransformer(MODEL_NAME)


def article_input_text(
    title: str,
    description: str | None = None,
    author: str | None = None,
) -> str:
    """Build the text we embed. Keep it short — beyond ~256 tokens the
    tokenizer truncates anyway, so feeding longer text wastes compute."""
    parts = [title.strip()]
    if description:
        parts.append(description.strip())
    if author:
        parts.append(f"by {author.strip()}")
    return ". ".join(parts)


def compute_embedding(text: str) -> list[float]:
    """Embed one string. Returns a 384-element list of floats."""
    if not text or not text.strip():
        raise ValueError("compute_embedding: empty text")
    vec = _model().encode(text, normalize_embeddings=True)
    # Return as plain list[float] so we can pass through pgvector / asyncpg.
    return [float(x) for x in vec.tolist()]


def compute_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Batch encode — much faster per-item than calling compute_embedding
    in a loop. Use this in the backfill where we have many articles."""
    if not texts:
        return []
    vecs = _model().encode(texts, normalize_embeddings=True, batch_size=32)
    return [[float(x) for x in v.tolist()] for v in vecs]

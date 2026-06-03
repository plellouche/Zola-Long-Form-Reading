"""Article scoring.

The score is a weighted combination of:
  - topic_sim: cosine similarity between user profile and article's topic vector
  - social_boost: count of followed users who saved this article (normalized)
  - quality: article.quality_score (admin-tunable prior)
  - freshness: exponential decay on age
  - source_trust: source.trust_score

Weights match COMMAND_CENTER §10's "For You" feed formula:
  topic_sim * 0.4 + social_boost * 0.2 + quality * 0.2 + freshness * 0.1 + source_trust * 0.1
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from uuid import UUID


def cosine_similarity(a: dict[UUID, float], b: dict[UUID, float]) -> float:
    """Sparse-dict cosine. Returns 0 if either vector is empty."""
    if not a or not b:
        return 0.0
    shared = a.keys() & b.keys()
    if not shared:
        return 0.0
    dot = sum(a[k] * b[k] for k in shared)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def dense_cosine(a: list[float] | None, b: list[float] | None) -> float:
    """Dense-vector cosine for sentence-transformer embeddings.

    Inputs are expected to be L2-normalized (build_user_embedding_profile +
    sentence_transformers default produce normalized vectors), so this is
    effectively a dot product. Falls back to 0 on missing data.
    """
    if a is None or b is None or len(a) != len(b):
        return 0.0
    return sum(x * y for x, y in zip(a, b, strict=True))


def freshness_score(reference_date, now: datetime | None = None) -> float:
    """Exponential decay: ~1.0 today, ~0.5 at ~21 days, ~0.1 at ~70 days."""
    if reference_date is None:
        return 0.3  # neutral prior for articles missing a publication date
    if now is None:
        now = datetime.now(timezone.utc)
    if isinstance(reference_date, datetime):
        days = max(0.0, (now - reference_date).total_seconds() / 86400.0)
    else:
        # date-only
        days = max(0.0, (now.date() - reference_date).days)
    return math.exp(-days / 30.0)


def score_article(
    *,
    article_topics: dict[UUID, float],
    user_profile: dict[UUID, float],
    quality: float,
    source_trust: float,
    social_count: int,
    reference_date,
    now: datetime | None = None,
    source_followed: bool = False,
    source_fatigued: bool = False,
    similarity: float | None = None,
) -> float:
    """When `similarity` is provided (e.g. an embedding cosine pre-computed
    upstream) it overrides the topic-cosine signal. Callers in Phase 18+
    pass the blended embedding+topic value so this function stays the
    single source of truth for weight tuning."""
    topic_sim = (
        similarity
        if similarity is not None
        else cosine_similarity(user_profile, article_topics)
    )
    social_norm = min(social_count * 0.25, 1.0)  # 4+ followee saves saturates
    fresh = freshness_score(reference_date, now)
    base = (
        topic_sim * 0.4
        + social_norm * 0.2
        + quality * 0.2
        + fresh * 0.1
        + source_trust * 0.1
    )
    if source_followed:
        base += 0.1
    if source_fatigued:
        base *= 0.5
    return base

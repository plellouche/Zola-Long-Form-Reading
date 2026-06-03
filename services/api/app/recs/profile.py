"""User topic profile: a sparse dict of {topic_id: weight}.

Built from two sources:
  - Explicit onboarding picks (user_topics)
  - Implicit signal from user_article_states, weighted by status

Negative weights (from DISMISSED articles) are clipped to 0 before
normalization — they pull the profile away from those topics without
producing negative cosine similarity (which would actively rank those
topics first when multiplied by themselves elsewhere).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Article, ArticleTopic, UserArticleState, UserTopic

STATUS_WEIGHTS = {
    "SAVED": 1.0,
    "READING": 1.5,
    "FINISHED": 2.0,
    "DISMISSED": -1.5,  # pulls profile away from this topic
    "INTERESTED": 0.6,  # lightweight positive signal from the discovery deck
}

# Recent signals weigh more so the For-You feed visibly shifts after a deck
# session. Anything updated within RECENT_WINDOW gets multiplied by
# RECENT_MULTIPLIER before being added into the profile.
RECENT_WINDOW = timedelta(days=7)
RECENT_MULTIPLIER = 1.5


async def build_user_topic_profile(session: AsyncSession, user_id: UUID) -> dict[UUID, float]:
    """Returns a normalized {topic_id: weight} dict. Empty if the user has
    no signals at all (e.g. just-onboarded user with no picks)."""

    profile: dict[UUID, float] = {}

    # ---- explicit interests from onboarding ----
    explicit_rows = await session.execute(
        select(UserTopic.topic_id, UserTopic.weight).where(UserTopic.user_id == user_id)
    )
    for tid, w in explicit_rows.all():
        profile[tid] = profile.get(tid, 0.0) + float(w)

    # ---- implicit signal from saved/finished/dismissed/interested articles ----
    states_rows = await session.execute(
        select(
            UserArticleState.article_id,
            UserArticleState.status,
            UserArticleState.updated_at,
        ).where(UserArticleState.user_id == user_id)
    )
    states_by_article: dict[UUID, tuple[str, datetime]] = {
        aid: (status, updated_at) for aid, status, updated_at in states_rows.all()
    }

    if states_by_article:
        now = datetime.now(timezone.utc)
        topics_rows = await session.execute(
            select(ArticleTopic.article_id, ArticleTopic.topic_id, ArticleTopic.weight)
            .where(ArticleTopic.article_id.in_(states_by_article.keys()))
        )
        for art_id, top_id, w in topics_rows.all():
            status, updated_at = states_by_article[art_id]
            mult = STATUS_WEIGHTS.get(status, 0.0)
            # Recency boost: signals within the last week weigh more, so the
            # feed responds quickly to a discovery-deck session.
            if updated_at is not None:
                ts = updated_at
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if now - ts <= RECENT_WINDOW:
                    mult *= RECENT_MULTIPLIER
            profile[top_id] = profile.get(top_id, 0.0) + float(w) * mult

    # ---- clip negatives + normalize to max ----
    profile = {k: v for k, v in profile.items() if v > 0}
    if not profile:
        return {}
    max_val = max(profile.values())
    return {k: v / max_val for k, v in profile.items()}


async def build_user_embedding_profile(
    session: AsyncSession, user_id: UUID
) -> list[float] | None:
    """User profile as a normalized centroid over the user's positively-
    signaled article embeddings.

    Returns None when the user has no signal yet OR none of their articles
    have embeddings yet (cold start). Callers fall back to topic-dict
    profile in that case.

    Status weights match the topic profile so the two systems stay
    consistent. Recency boost applies the same way.
    """
    states_rows = await session.execute(
        select(
            UserArticleState.article_id,
            UserArticleState.status,
            UserArticleState.updated_at,
        ).where(UserArticleState.user_id == user_id)
    )
    states = states_rows.all()
    if not states:
        return None

    now = datetime.now(timezone.utc)
    # Fetch article embeddings — pgvector returns string '[v1,v2,...]' over asyncpg.
    article_ids = [aid for aid, _, _ in states]
    emb_rows = await session.execute(
        select(Article.id, Article.embedding)
        .where(Article.id.in_(article_ids))
        .where(Article.embedding.is_not(None))
    )
    embeddings = {aid: _parse_pgvector(vec) for aid, vec in emb_rows.all()}
    if not embeddings:
        return None  # cold start: no embedded articles yet

    # Weighted sum, then normalize. DISMISSED produces a negative weight
    # which pulls the centroid away from that vector.
    dim = len(next(iter(embeddings.values())))
    centroid = [0.0] * dim
    total_weight = 0.0
    for aid, status, updated_at in states:
        vec = embeddings.get(aid)
        if vec is None:
            continue
        mult = STATUS_WEIGHTS.get(status, 0.0)
        if mult == 0.0:
            continue
        if updated_at is not None:
            ts = updated_at
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if now - ts <= RECENT_WINDOW:
                mult *= RECENT_MULTIPLIER
        for i, v in enumerate(vec):
            centroid[i] += v * mult
        total_weight += abs(mult)

    if total_weight == 0.0:
        return None

    # L2-normalize so cosine_similarity is a pure dot product.
    norm = (sum(c * c for c in centroid)) ** 0.5
    if norm == 0:
        return None
    return [c / norm for c in centroid]


def _parse_pgvector(value) -> list[float] | None:
    """asyncpg returns pgvector values as the literal string '[v1,v2,...]'
    unless a custom codec is registered. Parse to list[float] here.
    None-safe."""
    if value is None:
        return None
    if isinstance(value, list):
        return [float(x) for x in value]
    s = str(value).strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1]
    if not s:
        return None
    return [float(x) for x in s.split(",")]

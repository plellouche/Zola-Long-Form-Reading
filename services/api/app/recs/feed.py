"""Top-level recs entry points: for_you_feed, related_articles, list_recommendations.

All three follow the same pattern:
  1. Gather a candidate pool (~ recent articles, plus exclusion rules)
  2. Bulk-fetch each candidate's topic vector
  3. Score each candidate against a target profile
  4. Apply diversity, return the top-N items
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    Article,
    ArticleTopic,
    Event,
    Follow,
    ListItem,
    ReadingList,
    Source,
    UserArticleState,
)
from .diversity import ScoredCandidate, apply_diversity
from .profile import build_user_topic_profile
from .scorer import cosine_similarity, freshness_score, score_article

CANDIDATE_POOL_DAYS = 90
MAX_CANDIDATES_TO_SCORE = 400  # cap to keep per-request CPU bounded


async def _bulk_article_topics(
    session: AsyncSession, article_ids: list[UUID]
) -> dict[UUID, dict[UUID, float]]:
    if not article_ids:
        return {}
    rows = await session.execute(
        select(ArticleTopic.article_id, ArticleTopic.topic_id, ArticleTopic.weight).where(
            ArticleTopic.article_id.in_(article_ids)
        )
    )
    out: dict[UUID, dict[UUID, float]] = {}
    for art_id, top_id, w in rows.all():
        out.setdefault(art_id, {})[top_id] = float(w)
    return out


async def _social_save_counts(
    session: AsyncSession, viewer_id: UUID, article_ids: list[UUID]
) -> dict[UUID, int]:
    """For each article, how many users-I-follow have SAVE'd it."""
    if not article_ids:
        return {}
    rows = await session.execute(
        select(Event.article_id, func.count(Event.id))
        .join(Follow, Follow.followee_id == Event.user_id)
        .where(Follow.follower_id == viewer_id)
        .where(Event.event_type == "SAVE")
        .where(Event.article_id.in_(article_ids))
        .group_by(Event.article_id)
    )
    return {aid: int(c) for aid, c in rows.all()}


async def for_you_feed(
    session: AsyncSession, user_id: UUID, *, limit: int = 24
) -> list[Article]:
    """Personalized feed: scored candidate pool, diversity-filtered."""

    cutoff = datetime.now(timezone.utc) - timedelta(days=CANDIDATE_POOL_DAYS)

    # Articles the user has already interacted with — exclude.
    excluded_subq = (
        select(UserArticleState.article_id).where(UserArticleState.user_id == user_id)
    ).subquery()

    candidates_result = await session.execute(
        select(Article)
        .join(Source, Source.id == Article.source_id)
        .where(Source.is_active.is_(True))
        .where(Article.created_at >= cutoff)
        .where(Article.id.not_in(select(excluded_subq.c.article_id)))
        .order_by(Article.created_at.desc())
        .limit(MAX_CANDIDATES_TO_SCORE)
    )
    candidates = list(candidates_result.scalars().unique().all())
    if not candidates:
        return []

    profile = await build_user_topic_profile(session, user_id)
    topics_map = await _bulk_article_topics(session, [a.id for a in candidates])
    social = await _social_save_counts(session, user_id, [a.id for a in candidates])

    now = datetime.now(timezone.utc)
    scored: list[ScoredCandidate[Article]] = []
    for a in candidates:
        s = score_article(
            article_topics=topics_map.get(a.id, {}),
            user_profile=profile,
            quality=float(a.quality_score),
            source_trust=float(a.source.trust_score),
            social_count=social.get(a.id, 0),
            reference_date=a.publication_date or a.created_at,
            now=now,
        )
        scored.append(
            ScoredCandidate(
                item=a,
                score=s,
                source_id=a.source_id,
                author=a.author,
                topic_ids=frozenset(topics_map.get(a.id, {}).keys()),
            )
        )
    return apply_diversity(scored, limit)


async def related_articles(
    session: AsyncSession,
    seed_article_id: UUID,
    *,
    limit: int = 6,
    viewer_id: UUID | None = None,
) -> list[Article]:
    """Articles similar to a given article. Used on the article detail page."""

    seed = await session.scalar(select(Article).where(Article.id == seed_article_id))
    if seed is None:
        return []

    seed_topics_rows = await session.execute(
        select(ArticleTopic.topic_id, ArticleTopic.weight).where(
            ArticleTopic.article_id == seed_article_id
        )
    )
    seed_topics = {tid: float(w) for tid, w in seed_topics_rows.all()}
    if not seed_topics:
        # No topic signal: fall back to "newest from same source" minus the seed.
        result = await session.execute(
            select(Article)
            .where(Article.source_id == seed.source_id, Article.id != seed.id)
            .order_by(Article.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().unique().all())

    cutoff = datetime.now(timezone.utc) - timedelta(days=365)

    excluded_ids: set[UUID] = {seed_article_id}
    if viewer_id is not None:
        viewer_states = await session.execute(
            select(UserArticleState.article_id).where(UserArticleState.user_id == viewer_id)
        )
        excluded_ids.update(aid for (aid,) in viewer_states.all())

    candidates_result = await session.execute(
        select(Article)
        .join(Source, Source.id == Article.source_id)
        .where(Source.is_active.is_(True))
        .where(Article.created_at >= cutoff)
        .where(Article.id.not_in(excluded_ids))
        .order_by(Article.created_at.desc())
        .limit(MAX_CANDIDATES_TO_SCORE)
    )
    candidates = list(candidates_result.scalars().unique().all())
    if not candidates:
        return []

    topics_map = await _bulk_article_topics(session, [a.id for a in candidates])

    now = datetime.now(timezone.utc)
    scored: list[ScoredCandidate[Article]] = []
    for a in candidates:
        sim = cosine_similarity(seed_topics, topics_map.get(a.id, {}))
        if sim <= 0:
            continue
        fresh = freshness_score(a.publication_date or a.created_at, now)
        s = sim * 0.7 + float(a.quality_score) * 0.15 + fresh * 0.1 + float(a.source.trust_score) * 0.05
        scored.append(
            ScoredCandidate(
                item=a,
                score=s,
                source_id=a.source_id,
                author=a.author,
                topic_ids=frozenset(topics_map.get(a.id, {}).keys()),
            )
        )
    return apply_diversity(scored, limit)


async def list_recommendations(
    session: AsyncSession,
    list_id: UUID,
    *,
    limit: int = 6,
) -> list[Article]:
    """Articles that match a list's topic profile but aren't already in it.

    The list profile is the position-weighted union of its items' topic
    vectors (earlier items weighted slightly higher).
    """

    target = await session.scalar(select(ReadingList).where(ReadingList.id == list_id))
    if target is None or not target.items:
        return []

    sorted_items = sorted(target.items, key=lambda li: li.position)
    item_count = len(sorted_items)
    # Earlier items: weight 1.0 → 0.5 (linear). Single-item lists weight 1.0.
    if item_count == 1:
        item_weights = {sorted_items[0].article_id: 1.0}
    else:
        item_weights = {
            li.article_id: 1.0 - 0.5 * (idx / (item_count - 1))
            for idx, li in enumerate(sorted_items)
        }

    list_topics_rows = await session.execute(
        select(ArticleTopic.article_id, ArticleTopic.topic_id, ArticleTopic.weight).where(
            ArticleTopic.article_id.in_(item_weights.keys())
        )
    )
    list_profile: dict[UUID, float] = {}
    for art_id, top_id, w in list_topics_rows.all():
        list_profile[top_id] = list_profile.get(top_id, 0.0) + float(w) * item_weights[art_id]
    if not list_profile:
        return []
    max_w = max(list_profile.values())
    list_profile = {k: v / max_w for k, v in list_profile.items()}

    already_in_list: set[UUID] = set(item_weights.keys())

    cutoff = datetime.now(timezone.utc) - timedelta(days=365)
    candidates_result = await session.execute(
        select(Article)
        .join(Source, Source.id == Article.source_id)
        .where(Source.is_active.is_(True))
        .where(Article.created_at >= cutoff)
        .where(Article.id.not_in(already_in_list))
        .order_by(Article.created_at.desc())
        .limit(MAX_CANDIDATES_TO_SCORE)
    )
    candidates = list(candidates_result.scalars().unique().all())
    if not candidates:
        return []

    topics_map = await _bulk_article_topics(session, [a.id for a in candidates])

    now = datetime.now(timezone.utc)
    scored: list[ScoredCandidate[Article]] = []
    for a in candidates:
        sim = cosine_similarity(list_profile, topics_map.get(a.id, {}))
        if sim <= 0:
            continue
        fresh = freshness_score(a.publication_date or a.created_at, now)
        # Bonus for filling under-represented topics (coverage signal).
        a_tops = topics_map.get(a.id, {})
        coverage_bonus = sum(
            max(0.0, 1.0 - list_profile.get(t, 0.0)) * a_tops[t] for t in a_tops
        ) / max(1, len(a_tops))
        s = (
            sim * 0.55
            + coverage_bonus * 0.15
            + float(a.quality_score) * 0.15
            + fresh * 0.1
            + float(a.source.trust_score) * 0.05
        )
        scored.append(
            ScoredCandidate(
                item=a,
                score=s,
                source_id=a.source_id,
                author=a.author,
                topic_ids=frozenset(topics_map.get(a.id, {}).keys()),
            )
        )
    return apply_diversity(scored, limit)

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

from ..filters import arachnid_exclude_clause
from ..models import (
    Article,
    ArticleTopic,
    Event,
    Follow,
    ListItem,
    ReadingList,
    Source,
    SourceFollow,
    UserArticleState,
)
from .diversity import ScoredCandidate, apply_diversity
from .profile import (
    _parse_pgvector,
    build_user_embedding_profile,
    build_user_topic_profile,
)
from .scorer import cosine_similarity, dense_cosine, freshness_score, score_article

CANDIDATE_POOL_DAYS = 90
DISCOVER_POOL_DAYS = 180  # deck digs a bit deeper than the For-You feed
MAX_CANDIDATES_TO_SCORE = 400  # cap to keep per-request CPU bounded
SOURCE_FATIGUE_WINDOW = timedelta(days=7)


async def _followed_source_ids(session: AsyncSession, user_id: UUID) -> set[UUID]:
    rows = await session.execute(
        select(SourceFollow.source_id).where(SourceFollow.user_id == user_id)
    )
    return {sid for (sid,) in rows.all()}


async def _fatigued_source_ids(session: AsyncSession, user_id: UUID) -> set[UUID]:
    """Sources the user swiped-down on within SOURCE_FATIGUE_WINDOW."""
    cutoff = datetime.now(timezone.utc) - SOURCE_FATIGUE_WINDOW
    rows = await session.execute(
        select(Event.event_metadata)
        .where(Event.user_id == user_id)
        .where(Event.event_type == "SOURCE_FATIGUE")
        .where(Event.created_at >= cutoff)
    )
    out: set[UUID] = set()
    for (md,) in rows.all():
        sid = (md or {}).get("source_id")
        if sid:
            try:
                out.add(UUID(sid))
            except (TypeError, ValueError):
                continue
    return out


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


async def _bulk_article_embeddings(
    session: AsyncSession, article_ids: list[UUID]
) -> dict[UUID, list[float]]:
    """Fetch per-article embeddings. Returns dict; absent IDs = no embedding
    yet (backfill hasn't processed them). Callers must handle missing entries."""
    if not article_ids:
        return {}
    rows = await session.execute(
        select(Article.id, Article.embedding)
        .where(Article.id.in_(article_ids))
        .where(Article.embedding.is_not(None))
    )
    out: dict[UUID, list[float]] = {}
    for aid, vec in rows.all():
        parsed = _parse_pgvector(vec)
        if parsed is not None:
            out[aid] = parsed
    return out


async def _article_rating_scores(
    session: AsyncSession, article_ids: list[UUID]
) -> dict[UUID, float]:
    """Per-article aggregate rating score, normalized to 0-1.

    LOVED=2, LIKED=1, OK=0 — averaged across all raters. Articles with no
    ratings are absent from the result (caller treats absence as 0.5,
    neutral). Used by the discover deck to bias toward articles other
    readers actually loved, not just popular-by-save-count.
    """
    if not article_ids:
        return {}
    score_expr = func.sum(
        func.coalesce(
            func.nullif(
                # CASE WHEN rating='LOVED' THEN 2 WHEN rating='LIKED' THEN 1 ELSE 0 END
                # SQLAlchemy: use case() construct
                None,
                None,
            ),
            0,
        )
    )
    from sqlalchemy import case
    rating_points = case(
        (UserArticleState.rating == "LOVED", 2.0),
        (UserArticleState.rating == "LIKED", 1.0),
        (UserArticleState.rating == "OK", 0.0),
        else_=0.0,
    )
    rows = await session.execute(
        select(
            UserArticleState.article_id,
            func.avg(rating_points).label("avg"),
            func.count(UserArticleState.id).label("n"),
        )
        .where(UserArticleState.article_id.in_(article_ids))
        .where(UserArticleState.rating.is_not(None))
        .group_by(UserArticleState.article_id)
    )
    out: dict[UUID, float] = {}
    for aid, avg, n in rows.all():
        # Normalize 0-2 -> 0-1. Soft floor at low rater counts so a single
        # OK doesn't tank an article; weight = n / (n + 3) (Bayesian-ish).
        n = int(n or 0)
        avg_norm = (float(avg or 0)) / 2.0
        confidence = n / (n + 3.0)
        # Blend toward neutral (0.5) for low-confidence cases.
        out[aid] = 0.5 + confidence * (avg_norm - 0.5)
    return out


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
        .where(arachnid_exclude_clause(Article))
        .order_by(Article.created_at.desc())
        .limit(MAX_CANDIDATES_TO_SCORE)
    )
    candidates = list(candidates_result.scalars().unique().all())
    if not candidates:
        return []

    article_ids = [a.id for a in candidates]
    topic_profile = await build_user_topic_profile(session, user_id)
    embedding_profile = await build_user_embedding_profile(session, user_id)
    topics_map = await _bulk_article_topics(session, article_ids)
    embedding_map = await _bulk_article_embeddings(session, article_ids)
    social = await _social_save_counts(session, user_id, article_ids)
    followed_sources = await _followed_source_ids(session, user_id)
    fatigued_sources = await _fatigued_source_ids(session, user_id)

    now = datetime.now(timezone.utc)
    scored: list[ScoredCandidate[Article]] = []
    for a in candidates:
        # Blend embedding cosine with topic-dict cosine. Falls back to
        # topic-only when either side lacks an embedding.
        topic_sim = cosine_similarity(topic_profile, topics_map.get(a.id, {}))
        emb_sim = dense_cosine(embedding_profile, embedding_map.get(a.id))
        blended_sim = (
            emb_sim * 0.7 + topic_sim * 0.3
            if embedding_profile is not None and a.id in embedding_map
            else topic_sim
        )
        s = score_article(
            article_topics=topics_map.get(a.id, {}),
            user_profile=topic_profile,
            quality=float(a.quality_score),
            source_trust=float(a.source.trust_score),
            social_count=social.get(a.id, 0),
            reference_date=a.publication_date or a.created_at,
            now=now,
            source_followed=a.source_id in followed_sources,
            source_fatigued=a.source_id in fatigued_sources,
            similarity=blended_sim,
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


async def for_discover_deck(
    session: AsyncSession, user_id: UUID, *, limit: int = 25
) -> list[Article]:
    """Candidate pool for the swipe deck.

    Differs from for_you_feed:
      - Bigger time window (DISCOVER_POOL_DAYS) so newcomers don't run out fast.
      - Topic-similarity weighted higher (0.5 via score_article tweak below).
      - Diversity loosened to max_per_source=4 — exploring a source is fine.
      - Excludes anything the user already swiped on (any user_article_states row).
    """

    cutoff = datetime.now(timezone.utc) - timedelta(days=DISCOVER_POOL_DAYS)

    excluded_subq = (
        select(UserArticleState.article_id).where(UserArticleState.user_id == user_id)
    ).subquery()

    candidates_result = await session.execute(
        select(Article)
        .join(Source, Source.id == Article.source_id)
        .where(Source.is_active.is_(True))
        .where(Article.created_at >= cutoff)
        .where(Article.id.not_in(select(excluded_subq.c.article_id)))
        .where(arachnid_exclude_clause(Article))
        .order_by(Article.created_at.desc())
        .limit(MAX_CANDIDATES_TO_SCORE)
    )
    candidates = list(candidates_result.scalars().unique().all())
    if not candidates:
        return []

    article_ids = [a.id for a in candidates]
    topic_profile = await build_user_topic_profile(session, user_id)
    embedding_profile = await build_user_embedding_profile(session, user_id)
    topics_map = await _bulk_article_topics(session, article_ids)
    embedding_map = await _bulk_article_embeddings(session, article_ids)
    social = await _social_save_counts(session, user_id, article_ids)
    rating_scores = await _article_rating_scores(session, article_ids)
    followed_sources = await _followed_source_ids(session, user_id)
    fatigued_sources = await _fatigued_source_ids(session, user_id)

    now = datetime.now(timezone.utc)
    scored: list[ScoredCandidate[Article]] = []
    for a in candidates:
        # Two similarity signals — embedding (the workhorse, once populated)
        # and the topic-dict cosine (still useful, plus the only signal
        # available during the embedding backfill window). We blend rather
        # than swap so the system degrades gracefully as embeddings populate.
        topic_sim = cosine_similarity(topic_profile, topics_map.get(a.id, {}))
        emb_sim = dense_cosine(embedding_profile, embedding_map.get(a.id))
        # When embeddings are present on both sides, lean into them (0.35).
        # When either side has no embedding, fall back to topic_sim only.
        if embedding_profile is not None and a.id in embedding_map:
            sim = emb_sim * 0.7 + topic_sim * 0.3
        else:
            sim = topic_sim
        social_norm = min(social.get(a.id, 0) * 0.25, 1.0)
        # Absent articles are neutral (0.5) so unrated content isn't penalized.
        rating_norm = rating_scores.get(a.id, 0.5)
        fresh = freshness_score(a.publication_date or a.created_at, now)
        s = (
            sim * 0.40
            + rating_norm * 0.15
            + social_norm * 0.10
            + float(a.quality_score) * 0.15
            + fresh * 0.10
            + float(a.source.trust_score) * 0.05
        )
        if a.source_id in followed_sources:
            s += 0.1
        if a.source_id in fatigued_sources:
            s *= 0.5
        scored.append(
            ScoredCandidate(
                item=a,
                score=s,
                source_id=a.source_id,
                author=a.author,
                topic_ids=frozenset(topics_map.get(a.id, {}).keys()),
            )
        )
    return apply_diversity(scored, limit, max_per_source=4)


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
            .where(arachnid_exclude_clause(Article))
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
        .where(arachnid_exclude_clause(Article))
        .order_by(Article.created_at.desc())
        .limit(MAX_CANDIDATES_TO_SCORE)
    )
    candidates = list(candidates_result.scalars().unique().all())
    if not candidates:
        return []

    article_ids = [a.id for a in candidates]
    topics_map = await _bulk_article_topics(session, article_ids)
    # Embed the seed (if it has one) + every candidate, so we can rank by
    # full-content similarity, not just topic overlap.
    seed_embedding_map = await _bulk_article_embeddings(session, [seed_article_id])
    seed_embedding = seed_embedding_map.get(seed_article_id)
    embedding_map = await _bulk_article_embeddings(session, article_ids)

    now = datetime.now(timezone.utc)
    scored: list[ScoredCandidate[Article]] = []
    for a in candidates:
        topic_sim = cosine_similarity(seed_topics, topics_map.get(a.id, {}))
        emb_sim = dense_cosine(seed_embedding, embedding_map.get(a.id))
        # Blend when both sides embedded; topic-only otherwise.
        sim = (
            emb_sim * 0.7 + topic_sim * 0.3
            if seed_embedding is not None and a.id in embedding_map
            else topic_sim
        )
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
        .where(arachnid_exclude_clause(Article))
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

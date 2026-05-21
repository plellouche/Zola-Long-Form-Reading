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

from ..models import ArticleTopic, UserArticleState, UserTopic

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

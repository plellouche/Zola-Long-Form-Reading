"""Reading leaderboard among the viewer's follow graph.

Ranks the viewer + people they follow by hours_read in a period. Returning
'all' users would devolve into a top-N global leaderboard, which encourages
the wrong loop ("read as fast as possible to climb"). Scoping to follows
makes it a social game with the people you actually care about.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user
from ..database import get_session
from ..models import Article, Follow, Profile, UserArticleState
from ..schemas import LeaderboardEntry, PublicProfile

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

Period = Literal["week", "month", "all_time"]


@router.get("/hours", response_model=list[LeaderboardEntry])
async def hours_leaderboard(
    period: Period = Query(default="week"),
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[LeaderboardEntry]:
    """Rank viewer + everyone they follow by hours read in `period`."""

    # Build participant set: self + everyone the viewer follows.
    followee_q = select(Follow.followee_id).where(Follow.follower_id == current.id)
    participant_ids_subq = followee_q.union(select(current.id).label("u")).subquery()

    # Time window for FINISHED events.
    time_window_clause = None
    if period == "week":
        time_window_clause = UserArticleState.finished_at >= func.now() - timedelta(days=7)
    elif period == "month":
        time_window_clause = UserArticleState.finished_at >= func.now() - timedelta(days=30)
    # 'all_time' has no time filter.

    where_clauses = [
        UserArticleState.user_id.in_(select(participant_ids_subq)),
        UserArticleState.status == "FINISHED",
    ]
    if time_window_clause is not None:
        where_clauses.append(time_window_clause)

    stats_q = (
        select(
            UserArticleState.user_id.label("user_id"),
            func.coalesce(
                func.sum(Article.reading_time_minutes), 0
            ).label("total_minutes"),
            func.count(UserArticleState.id).label("finished_count"),
        )
        .join(Article, Article.id == UserArticleState.article_id)
        .where(*where_clauses)
        .group_by(UserArticleState.user_id)
    )
    stats_rows = (await session.execute(stats_q)).all()
    stats_by_user = {
        r.user_id: (int(r.total_minutes or 0), int(r.finished_count or 0))
        for r in stats_rows
    }

    # Load profiles for everyone in the participant set, even zero-readers,
    # so the leaderboard tells the truth about who's lapping who.
    participant_ids = await session.execute(
        select(participant_ids_subq)
    )
    ids = [row[0] for row in participant_ids.all()]
    if not ids:
        return []

    profiles_q = (
        select(Profile)
        .where(Profile.id.in_(ids), Profile.onboarded_at.is_not(None))
    )
    profiles = (await session.execute(profiles_q)).scalars().all()

    # Followers/following counts in one shot keeps the response sane.
    follower_counts_q = (
        select(Follow.followee_id, func.count(Follow.id))
        .where(Follow.followee_id.in_(ids))
        .group_by(Follow.followee_id)
    )
    follower_counts = {
        row[0]: int(row[1]) for row in (await session.execute(follower_counts_q)).all()
    }
    following_counts_q = (
        select(Follow.follower_id, func.count(Follow.id))
        .where(Follow.follower_id.in_(ids))
        .group_by(Follow.follower_id)
    )
    following_counts = {
        row[0]: int(row[1]) for row in (await session.execute(following_counts_q)).all()
    }

    # Sort: hours desc, then finished_count desc, then username asc for stability.
    enriched = []
    for p in profiles:
        minutes, finished = stats_by_user.get(p.id, (0, 0))
        enriched.append((p, minutes, finished))
    enriched.sort(key=lambda t: (-t[1], -t[2], t[0].username or ""))

    out: list[LeaderboardEntry] = []
    for rank, (p, minutes, finished) in enumerate(enriched, start=1):
        public = PublicProfile.model_validate(p)
        public.followers_count = follower_counts.get(p.id, 0)
        public.following_count = following_counts.get(p.id, 0)
        public.is_self = p.id == current.id
        public.am_following = p.id != current.id  # all non-self are followed by definition
        out.append(
            LeaderboardEntry(
                profile=public,
                hours_read=round(minutes / 60, 1),
                finished_count=finished,
                rank=rank,
            )
        )
    return out

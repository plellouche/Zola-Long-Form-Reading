from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import CurrentUser, get_current_user, get_current_user_optional
from ..auth_admin import maybe_bootstrap_admin
from ..config import Settings, get_settings
from ..database import get_session
from ..models import (
    Article,
    ArticleEloRating,
    Follow,
    Profile,
    Source,
    Topic,
    UserArticleState,
    UserTopic,
)
from ..schemas import (
    ArticleSummary,
    OnboardingRequest,
    ProfileMe,
    ProfileStats,
    ProfileUpdate,
    PublicProfile,
)

router = APIRouter(prefix="/api/users", tags=["users"])


async def _load_profile(session: AsyncSession, user_id: UUID) -> Profile:
    result = await session.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        # The auth.users → profiles trigger should always run; if it didn't, surface clearly.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile row missing for current user; signup trigger may have failed.",
        )
    return profile


@router.get("/me", response_model=ProfileMe)
async def get_me(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> Profile:
    profile = await _load_profile(session, current.id)
    await maybe_bootstrap_admin(session, profile, current, settings)
    return profile


@router.patch("/me", response_model=ProfileMe)
async def update_me(
    payload: ProfileUpdate,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Profile:
    profile = await _load_profile(session, current.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await session.commit()
    await session.refresh(profile)
    return profile


@router.post("/me/onboarding", response_model=ProfileMe)
async def complete_onboarding(
    payload: OnboardingRequest,
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Profile:
    profile = await _load_profile(session, current.id)

    if profile.onboarded_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Onboarding already completed.",
        )

    # Validate referenced topics exist.
    if payload.topic_ids:
        result = await session.execute(select(Topic.id).where(Topic.id.in_(payload.topic_ids)))
        found = {row[0] for row in result.all()}
        missing = set(payload.topic_ids) - found
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown topic ids: {sorted(str(m) for m in missing)}",
            )

    profile.username = payload.username
    if payload.display_name is not None:
        profile.display_name = payload.display_name
    profile.onboarded_at = datetime.now(timezone.utc)

    # Replace user_topics with the new set (onboarding only runs once, so 'replace' is fine).
    await session.execute(delete(UserTopic).where(UserTopic.user_id == current.id))
    for topic_id in payload.topic_ids:
        session.add(UserTopic(user_id=current.id, topic_id=topic_id, weight=1.0))

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        # Most likely a duplicate username.
        if "profiles_username_key" in str(exc.orig) or "duplicate key" in str(exc.orig).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken.",
            ) from exc
        raise

    await session.refresh(profile)
    return profile


@router.get("", response_model=list[PublicProfile])
async def list_discoverable_users(
    viewer: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    limit: int = 100,
    sort: str = "active",
):
    """Public directory of opt-in users. Signed-in viewers only.

    `sort=active`  — by most-recent event timestamp DESC (default)
    `sort=newest`  — by signup date DESC
    `sort=name`    — alphabetical by display_name / username
    """
    from sqlalchemy import case, desc as sa_desc
    from ..models import Event
    limit = max(1, min(limit, 200))

    last_active_sq = (
        select(
            Event.user_id.label("uid"),
            func.max(Event.created_at).label("last_at"),
        )
        .group_by(Event.user_id)
        .subquery()
    )
    follower_count_sq = (
        select(
            Follow.followee_id.label("uid"),
            func.count(Follow.id).label("c"),
        )
        .group_by(Follow.followee_id)
        .subquery()
    )

    stmt = (
        select(Profile, last_active_sq.c.last_at, func.coalesce(follower_count_sq.c.c, 0).label("followers"))
        .outerjoin(last_active_sq, last_active_sq.c.uid == Profile.id)
        .outerjoin(follower_count_sq, follower_count_sq.c.uid == Profile.id)
        .where(Profile.discoverable.is_(True), Profile.onboarded_at.is_not(None))
        .limit(limit)
    )
    if sort == "newest":
        stmt = stmt.order_by(Profile.created_at.desc())
    elif sort == "name":
        stmt = stmt.order_by(func.lower(func.coalesce(Profile.display_name, Profile.username)))
    else:  # active
        stmt = stmt.order_by(sa_desc(func.coalesce(last_active_sq.c.last_at, Profile.created_at)))

    rows = (await session.execute(stmt)).all()

    # Who does the viewer already follow? One query, dedupe.
    profile_ids = [p.id for p, _, _ in rows]
    am_following: set = set()
    if profile_ids:
        follow_rows = await session.execute(
            select(Follow.followee_id).where(
                Follow.follower_id == viewer.id,
                Follow.followee_id.in_(profile_ids),
            )
        )
        am_following = {fid for (fid,) in follow_rows.all()}

    out: list[PublicProfile] = []
    for p, _last_at, followers in rows:
        pub = PublicProfile.model_validate(p)
        pub.followers_count = int(followers or 0)
        pub.am_following = p.id in am_following
        pub.is_self = p.id == viewer.id
        out.append(pub)
    return out


@router.get("/{username}", response_model=PublicProfile)
async def get_user_by_username(
    username: str,
    viewer: CurrentUser | None = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
) -> PublicProfile:
    profile = await session.scalar(
        select(Profile).where(
            Profile.username == username.lower(),
            Profile.onboarded_at.is_not(None),
        )
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    followers = await session.scalar(
        select(func.count()).select_from(Follow).where(Follow.followee_id == profile.id)
    )
    following = await session.scalar(
        select(func.count()).select_from(Follow).where(Follow.follower_id == profile.id)
    )
    am_following = False
    is_self = False
    if viewer is not None:
        is_self = viewer.id == profile.id
        if not is_self:
            am_following = bool(
                await session.scalar(
                    select(Follow).where(
                        Follow.follower_id == viewer.id,
                        Follow.followee_id == profile.id,
                    )
                )
            )

    out = PublicProfile.model_validate(profile)
    out.followers_count = int(followers or 0)
    out.following_count = int(following or 0)
    out.am_following = am_following
    out.is_self = is_self
    return out


@router.get("/{username}/stats", response_model=ProfileStats)
async def get_user_stats(
    username: str,
    session: AsyncSession = Depends(get_session),
) -> ProfileStats:
    profile = await session.scalar(
        select(Profile).where(
            Profile.username == username.lower(),
            Profile.onboarded_at.is_not(None),
        )
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    finished_q = (
        select(
            func.count(UserArticleState.id).label("n"),
            func.coalesce(func.sum(Article.reading_time_minutes), 0).label("total_minutes"),
            func.count(func.distinct(Article.source_id)).label("sources"),
            func.coalesce(func.avg(Article.reading_time_minutes), 0).label("avg_minutes"),
        )
        .join(Article, Article.id == UserArticleState.article_id)
        .where(
            UserArticleState.user_id == profile.id,
            UserArticleState.status == "FINISHED",
        )
    )
    row = (await session.execute(finished_q)).one()
    finished_count = int(row.n or 0)
    total_minutes = int(row.total_minutes or 0)
    sources_explored = int(row.sources or 0)
    avg_minutes_val = float(row.avg_minutes or 0)
    avg_minutes = int(round(avg_minutes_val)) if finished_count > 0 else None

    # Top source: most-finished publication.
    top_source_q = (
        select(
            Source.slug,
            Source.name,
            func.count(UserArticleState.id).label("c"),
        )
        .join(Article, Article.id == UserArticleState.article_id)
        .join(Source, Source.id == Article.source_id)
        .where(
            UserArticleState.user_id == profile.id,
            UserArticleState.status == "FINISHED",
        )
        .group_by(Source.id, Source.slug, Source.name)
        .order_by(func.count(UserArticleState.id).desc())
        .limit(1)
    )
    top_row = (await session.execute(top_source_q)).first()
    top_source = (
        {"slug": top_row.slug, "name": top_row.name, "count": int(top_row.c)}
        if top_row is not None else None
    )

    # Streak: how many consecutive days ending today have ≥1 finish?
    # Cheap to compute server-side: pull distinct finish dates for the last
    # 60 days and walk backward from today. 60 covers any realistic streak.
    streak_q = (
        select(
            func.distinct(func.date(UserArticleState.finished_at)).label("d")
        )
        .where(
            UserArticleState.user_id == profile.id,
            UserArticleState.status == "FINISHED",
            UserArticleState.finished_at.is_not(None),
            UserArticleState.finished_at >= func.now() - text("interval '60 days'"),
        )
    )
    finished_days = {r.d for r in (await session.execute(streak_q)).all() if r.d is not None}
    streak = 0
    today = datetime.now(timezone.utc).date()
    # Allow the streak to "start" today OR yesterday so that someone who
    # hasn't read yet today doesn't see their N-day streak vanish at midnight.
    from datetime import timedelta
    d = today if today in finished_days else today - timedelta(days=1)
    while d in finished_days:
        streak += 1
        d = d - timedelta(days=1)

    return ProfileStats(
        finished_count=finished_count,
        hours_read=round(total_minutes / 60, 1),
        sources_explored=sources_explored,
        avg_minutes=avg_minutes,
        current_streak=streak,
        top_source=top_source,
    )


# Strictness ordering for rating sort: LOVED first, then LIKED, then OK.
# Using a CASE expression keeps the query single-pass.
_RATING_ORDER = {"LOVED": 0, "LIKED": 1, "OK": 2}


@router.get("/{username}/top-rated", response_model=list[ArticleSummary])
async def get_top_rated(
    username: str,
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
) -> list[ArticleSummary]:
    """Articles the user rated, ordered LOVED -> LIKED -> OK, recency tiebreak.

    Public — anyone can see anyone's top-rated list (it's the personal canon
    the gamification loop is meant to surface). Returns ArticleSummary so the
    same card components work on the consumer.
    """
    profile = await session.scalar(
        select(Profile).where(
            Profile.username == username.lower(),
            Profile.onboarded_at.is_not(None),
        )
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    from sqlalchemy import case
    from sqlalchemy.orm import aliased
    # CASE on rating tier; LOVED first, then LIKED, then OK.
    tier_expr = case(
        (UserArticleState.rating == "LOVED", 0),
        (UserArticleState.rating == "LIKED", 1),
        (UserArticleState.rating == "OK", 2),
        else_=99,
    )

    # LEFT JOIN Elo: articles without any pairwise vote fall back to the
    # default 1200, so they sort below ones the user has actually compared.
    elo = aliased(ArticleEloRating)
    elo_score = func.coalesce(elo.score, 1200.0)

    stmt = (
        select(Article, elo_score.label("elo"), tier_expr.label("tier"))
        .join(Article, Article.id == UserArticleState.article_id)
        .outerjoin(
            elo,
            (elo.user_id == profile.id) & (elo.article_id == UserArticleState.article_id),
        )
        .where(
            UserArticleState.user_id == profile.id,
            UserArticleState.rating.is_not(None),
        )
        .order_by(
            tier_expr.asc(),
            elo_score.desc(),
            UserArticleState.finished_at.desc().nullslast(),
        )
        .limit(max(1, min(limit, 50)))
    )

    rows = (await session.execute(stmt)).unique().all()
    return [ArticleSummary.model_validate(a) for (a, _elo, _tier) in rows]
